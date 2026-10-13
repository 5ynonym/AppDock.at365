using System.IO;
using System.Text;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Windows;
using AppDock.Runtime;

namespace AppDock.InputHost;
internal static class Program
{
    [DllImport("shell32.dll")] private static extern int SHQueryUserNotificationState(out int state);
    private static async Task<int> NotificationState(TextWriter output)
    {
        await using var peer = new JsonRpcConnection(Console.In, output);
        await peer.ReadAsync((method, p) => {
            if (method != "notifications.state") throw new ArgumentException("Unknown notification query.");
            var result = SHQueryUserNotificationState(out var state);
            return Task.FromResult<object?>(new { accepts = result >= 0 && state == 5 });
        });
        return 0;
    }
    [STAThread] public static int Main(string[] args)
    {
        if (!Console.IsInputRedirected) return 2;
        Console.InputEncoding = Encoding.UTF8; Console.OutputEncoding = new UTF8Encoding(false);
        var output = Console.Out; Console.SetOut(Console.Error);
        if (args.SequenceEqual(new[] { "--notification-state" })) return NotificationState(output).GetAwaiter().GetResult();
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        using var engine = new GestureEngine(app.Dispatcher);
        _ = Task.Run(async () => {
            await using var peer = new JsonRpcConnection(Console.In, output);
            using var inputSender = new InputSender();
            engine.Invoke = p => peer.RequestAsync("gestures.invoke", p, peer.Lifetime);
            engine.Cancel = id => { _ = peer.NotifyAsync("gestures.cancel", new { session = id }); };
            try {
                await peer.ReadAsync(async (method, p) => {
                    if (method == "input.cancel") { inputSender.Cancel(p.GetProperty("id").GetString()!); return null; }
                    if (method is "input.sendKeys" or "input.appCommand") return await inputSender.ExecuteAsync(method, p, peer.Lifetime);
                    if (method == "gestures.valid") return await app.Dispatcher.InvokeAsync(() => engine.Valid(p.GetProperty("session").GetString()!,p.GetProperty("window").GetString()!));
                    if (method != "gestures.sync") throw new ArgumentException("Unknown input method.");
                    var config = p.Deserialize<Configuration>(JsonRpcConnection.Json) ?? throw new ArgumentException("Missing configuration.");
                    await app.Dispatcher.InvokeAsync(() => engine.Configure(config));
                    return null;
                });
            } catch (Exception e) { Console.Error.WriteLine(e); }
            finally { await app.Dispatcher.InvokeAsync(() => app.Shutdown()); }
        });
        return app.Run();
    }
}
