using System.Runtime.InteropServices;
using System.Text.Json;

internal sealed class Target : Form
{
    private readonly List<string> events = [];
    private readonly nint previous = GetForegroundWindow();
    public Target() { Text = "AppDock isolated input target"; Width = 480; Height = 180; Controls.Add(new Label { Text = "Input verification window", Dock = DockStyle.Fill }); }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData) { events.Add("key:" + keyData); return true; }
    protected override void WndProc(ref Message m) {
        if (m.Msg == 0x0319) { events.Add("app:" + (((long)m.LParam >> 16) & 0x7ff)); m.Result = 1; return; }
        base.WndProc(ref m);
    }
    private object Call(string method) {
        if (method == "focus") {
            Show(); Activate();
            var thread = GetWindowThreadProcessId(GetForegroundWindow(), out _);
            var own = GetCurrentThreadId();
            var attached = thread != 0 && thread != own && AttachThreadInput(own, thread, true);
            try { SetForegroundWindow(Handle); }
            finally { if (attached) AttachThreadInput(own, thread, false); }
        }
        if (method == "clear") events.Clear();
        if (method == "hold") keybd_event(0x11, 0, 0, 0);
        if (method == "release") keybd_event(0x11, 0, 2, 0);
        return new { window = Handle.ToString(), focused = GetForegroundWindow() == Handle, events = events.ToArray() };
    }
    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        _ = Task.Run(async () => {
            try {
                while (await Console.In.ReadLineAsync() is string line) {
                    using var doc = JsonDocument.Parse(line);
                    var request = doc.RootElement;
                    var method = request.GetProperty("method").GetString()!;
                    object result = Invoke(() => Call(method));
                    Console.WriteLine(JsonSerializer.Serialize(new { jsonrpc = "2.0", id = request.GetProperty("id").GetString(), result }));
                }
            } finally { BeginInvoke(Close); }
        });
    }
    protected override void OnFormClosed(FormClosedEventArgs e) { keybd_event(0x11, 0, 2, 0); if (previous != 0) SetForegroundWindow(previous); base.OnFormClosed(e); }
    [STAThread] public static void Main() { Application.SetHighDpiMode(HighDpiMode.PerMonitorV2); Application.Run(new Target()); }
    [DllImport("user32.dll")] private static extern nint GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(nint window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(nint window, out uint pid);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, nuint extra);
}
