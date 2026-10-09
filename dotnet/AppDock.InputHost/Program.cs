using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows;
using AppDock.Runtime;

namespace AppDock.InputHost;
internal static class Program
{
    [STAThread] public static int Main()
    {
        if (!Console.IsInputRedirected) return 2;
        Console.InputEncoding = Encoding.UTF8; Console.OutputEncoding = new UTF8Encoding(false);
        var output = Console.Out; Console.SetOut(Console.Error);
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        using var engine = new GestureEngine(app.Dispatcher);
        _ = Task.Run(async () => {
            await using var peer = new JsonRpcConnection(Console.In, output);
            engine.Invoke = p => peer.RequestAsync("gestures.invoke", p, peer.Lifetime);
            engine.Cancel = id => { _ = peer.NotifyAsync("gestures.cancel", new { session = id }); };
            try {
                await peer.ReadAsync(async (method, p) => {
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
