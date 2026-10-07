using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace AppDock.Runtime;

// A single optional shell bridge for every desktop plane. It never loads Applets.
public static class WindowsWidgetSession
{
    public static async Task RunAsync(TextReader input, TextWriter output, uint hostProcess)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException();
        // Match Electron's per-monitor coordinates. A failed cross-DPI SetParent is reported.
        SetThreadDpiAwarenessContext(new nint(-4));
        await using var rpc = new JsonRpcConnection(input, output);
        var gate = new SemaphoreSlim(1, 1);
        await rpc.ReadAsync(async (method, p) => {
            await gate.WaitAsync();
            try
            {
                SetThreadDpiAwarenessContext(new nint(-4));
                var window = new nint(long.Parse(p.GetProperty("handle").GetString()!, System.Globalization.CultureInfo.InvariantCulture));
                GetWindowThreadProcessId(window, out var process);
                if (!IsWindow(window) || process != hostProcess) throw new InvalidOperationException("Window does not belong to AppDock.");
                if (method != "widgets.attach") throw new InvalidOperationException("Unknown widget shell method.");
                var desktop = FindDesktop();
                if (desktop == 0) throw new InvalidOperationException("Windowsのデスクトップ表示先が見つかりません。Explorerの起動後に再試行します。");
                if (GetParent(window) == desktop && GetWindowRect(window, out var current)
                    && current.Left == p.GetProperty("x").GetInt32() && current.Top == p.GetProperty("y").GetInt32()
                    && current.Right - current.Left == p.GetProperty("width").GetInt32()
                    && current.Bottom - current.Top == p.GetProperty("height").GetInt32())
                    return new { parent = desktop.ToInt64().ToString(), attached = true };
                var style = GetWindowLongPtr(window, -16).ToInt64();
                SetWindowLongPtr(window, -16, new nint((style & ~0x80000000L) | 0x40000000L)); // WS_POPUP -> WS_CHILD
                Marshal.SetLastPInvokeError(0);
                if (SetParent(window, desktop) == 0 && Marshal.GetLastPInvokeError() != 0) throw new Win32Exception(Marshal.GetLastPInvokeError());
                var point = new Point { X = p.GetProperty("x").GetInt32(), Y = p.GetProperty("y").GetInt32() };
                MapWindowPoints(0, desktop, ref point, 1);
                if (!SetWindowPos(window, 0, point.X, point.Y, p.GetProperty("width").GetInt32(), p.GetProperty("height").GetInt32(), 0x0010 | 0x0020 | 0x0040))
                    throw new Win32Exception(Marshal.GetLastPInvokeError());
                return new { parent = desktop.ToInt64().ToString(), attached = GetParent(window) == desktop };
            }
            finally { gate.Release(); }
        });
    }
    private static nint FindDesktop()
    {
        nint desktop = 0;
        // Use the shell surface containing the icon view, so transparent widgets are
        // above the wallpaper and below application windows. No wallpaper is changed.
        EnumWindows((window, _) => {
            if (FindWindowEx(window, 0, "SHELLDLL_DefView", null) != 0) { desktop = window; return false; }
            return true;
        }, 0);
        return desktop;
    }
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left; public int Top; public int Right; public int Bottom; }
    private delegate bool EnumWindowProc(nint window, nint parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowProc callback, nint parameter);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern nint FindWindowEx(nint parent, nint after, string className, string? title);
    [DllImport("user32.dll")] private static extern bool IsWindow(nint window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint window, out uint process);
    [DllImport("user32.dll", SetLastError = true)] private static extern nint SetParent(nint window, nint parent);
    [DllImport("user32.dll")] private static extern nint GetParent(nint window);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint window, out Rect rect);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern nint GetWindowLongPtr(nint window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)] private static extern nint SetWindowLongPtr(nint window, int index, nint value);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(nint window, nint after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern int MapWindowPoints(nint from, nint to, ref Point point, uint count);
    [DllImport("user32.dll")] private static extern nint SetThreadDpiAwarenessContext(nint context);
}
