using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace AppDock.Runtime;

// The existing .NET host also owns Windows hotkeys. Pause is not an Electron accelerator.
public static class WindowsHotKeySession
{
    public static async Task RunAsync(TextReader input, TextWriter output)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        await using var rpc = new JsonRpcConnection(input, output);
        using var loop = new HotKeyLoop(shortcut => NotifyAsync(rpc, shortcut));
        await loop.Ready;
        await rpc.ReadAsync(async (method, parameters) => method == "hotkeys.sync"
            ? await loop.SyncAsync(parameters.GetProperty("shortcuts").Deserialize<string[]>() ?? [])
            : throw new InvalidOperationException("Unknown hotkey method."));
    }

    private static async void NotifyAsync(JsonRpcConnection rpc, string shortcut)
    {
        try { await rpc.NotifyAsync("hotkeys.pressed", new { shortcut }); }
        catch (Exception error) { Console.Error.WriteLine(error.Message); }
    }

    private sealed class HotKeyLoop : IDisposable
    {
        private const uint WorkMessage = 0x8001;
        private readonly ConcurrentQueue<Action> work = new();
        private readonly Dictionary<string, int> registered = [];
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Thread thread;
        private readonly Action<string> pressed;
        private uint threadId;
        private int sequence;
        public Task Ready => ready.Task;

        public HotKeyLoop(Action<string> pressed)
        {
            this.pressed = pressed;
            thread = new Thread(Run) { IsBackground = true, Name = "AppDock hotkeys" };
            thread.Start();
        }

        private void Run()
        {
            threadId = GetCurrentThreadId();
            PeekMessage(out _, 0, 0, 0, 0); // Create the queue before accepting RPC requests.
            ready.SetResult();
            try
            {
                int result;
                while ((result = GetMessage(out var message, 0, 0, 0)) > 0)
                {
                    if (message.Message == WorkMessage)
                        while (work.TryDequeue(out var action)) action();
                    else if (message.Message == 0x0312)
                    {
                        var shortcut = registered.FirstOrDefault(pair => pair.Value == (int)message.WParam).Key;
                        if (shortcut is not null) pressed(shortcut);
                    }
                }
                if (result < 0) Console.Error.WriteLine($"GetMessage failed: {Marshal.GetLastWin32Error()}");
            }
            finally
            {
                foreach (var id in registered.Values) UnregisterHotKey(0, id);
                registered.Clear();
            }
        }

        public Task<object?> SyncAsync(string[] shortcuts)
        {
            var completion = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
            work.Enqueue(() =>
            {
                try
                {
                    foreach (var shortcut in registered.Keys.Except(shortcuts).ToArray())
                    {
                        UnregisterHotKey(0, registered[shortcut]);
                        registered.Remove(shortcut);
                    }
                    var statuses = new List<object>();
                    foreach (var shortcut in shortcuts.Distinct())
                    {
                        string? error = null;
                        if (!registered.ContainsKey(shortcut))
                        {
                            try
                            {
                                var (modifiers, key) = Parse(shortcut);
                                var id = ++sequence;
                                if (id > 0xBFFF) throw new InvalidOperationException("Hotkey ID limit reached. Restart AppDock.");
                                if (RegisterHotKey(0, id, modifiers | 0x4000, key)) registered.Add(shortcut, id);
                                else error = $"登録できません（Windowsエラー {Marshal.GetLastWin32Error()}）。ほかのアプリの割り当てを確認してください。";
                            }
                            catch (Exception exception) { error = exception.Message; }
                        }
                        statuses.Add(new { shortcut, registered = registered.ContainsKey(shortcut), error });
                    }
                    completion.SetResult(statuses);
                }
                catch (Exception error) { completion.SetException(error); }
            });
            if (!PostThreadMessage(threadId, WorkMessage, 0, 0))
                completion.TrySetException(new InvalidOperationException("Hotkey thread is unavailable."));
            return completion.Task;
        }

        private static (uint Modifiers, uint Key) Parse(string shortcut)
        {
            var parts = shortcut.Split('+');
            uint modifiers = 0;
            foreach (var part in parts[..^1]) modifiers |= part switch
            {
                "Alt" => 1u, "Ctrl" => 2u, "Shift" => 4u,
                _ => throw new InvalidOperationException("Unknown modifier.")
            };
            var key = parts[^1];
            uint virtualKey = key switch
            {
                "Pause" => 0x13, "Space" => 0x20, "Tab" => 9, "Enter" => 13,
                "Escape" => 27, "Backspace" => 8, "Delete" => 0x2E, "Insert" => 0x2D,
                "Home" => 0x24, "End" => 0x23, "PageUp" => 0x21, "PageDown" => 0x22,
                "Up" => 0x26, "Down" => 0x28, "Left" => 0x25, "Right" => 0x27,
                _ => 0
            };
            if (virtualKey == 0 && key.StartsWith('F') && int.TryParse(key.AsSpan(1), out var function) && function is >= 1 and <= 24)
                virtualKey = (uint)(0x70 + function - 1);
            if (virtualKey == 0 && key.Length == 1 && char.IsAsciiLetterOrDigit(key[0]))
                virtualKey = char.ToUpperInvariant(key[0]);
            if (virtualKey == 0)
            {
                var character = key == "Plus" ? '+' : key.Length == 1 ? key[0] : '\0';
                var code = VkKeyScanEx(character, GetKeyboardLayout(0));
                if (character == '\0' || code == -1) throw new InvalidOperationException($"このキーボードでは {shortcut} を登録できません。");
                virtualKey = (uint)(code & 0xFF);
                // VkKeyScan's modifier bits: Shift=1, Ctrl=2, Alt=4.
                var shift = (code >> 8) & 7;
                modifiers |= (uint)((shift & 1) << 2 | (shift & 2) | (shift & 4) >> 2);
            }
            return (modifiers, virtualKey);
        }

        public void Dispose()
        {
            work.Enqueue(() => PostQuitMessage(0));
            PostThreadMessage(threadId, WorkMessage, 0, 0);
            thread.Join();
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeMessage
    {
        public nint HWnd;
        public uint MessageId;
        public nuint WParam;
        public nint LParam;
        public uint Time;
        public int X;
        public int Y;
        public uint Private;
        public readonly uint Message => MessageId;
    }
    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(nint window, int id, uint modifiers, uint key);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnregisterHotKey(nint window, int id);
    [DllImport("user32.dll", SetLastError = true)] private static extern int GetMessage(out NativeMessage message, nint window, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out NativeMessage message, nint window, uint min, uint max, uint remove);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool PostThreadMessage(uint thread, uint message, nuint wParam, nint lParam);
    [DllImport("user32.dll")] private static extern void PostQuitMessage(int code);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern short VkKeyScanEx(char key, nint layout);
    [DllImport("user32.dll")] private static extern nint GetKeyboardLayout(uint thread);
}
