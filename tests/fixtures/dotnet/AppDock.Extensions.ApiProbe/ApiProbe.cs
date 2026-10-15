using AppDock.SDK;
using System.Text.Json;
namespace AppDock.Extensions.ApiProbe;

public sealed class ApiProbe : IAppDockExtension
{
    public async Task ActivateAsync(IExtensionContext context, CancellationToken cancellationToken)
    {
        // Existing API remains usable during activation, without any new permission.
        await context.Settings.SetAsync("privateFlag", true, cancellationToken);
        foreach (var action in new[] { "read", "write", "legacy", "self" })
            context.Commands.Register(context.ExtensionId + "." + action, action, async token => {
                object result;
                try {
                    if (action == "read") {
                        foreach (var method in new[] { "system.getInfo", "applets.list", "settings.getSchema", "settings.get", "commands.list", "shortcuts.get", "gestures.get", "ribbon.get", "tray.get" })
                            await context.AppDock.CallAsync(method, cancellationToken: token);
                        await context.AppDock.CallAsync("applets.get", new { id = context.ExtensionId }, token);
                        result = new { ok = true };
                    } else if (action == "write") {
                        var current = await context.AppDock.CallAsync("settings.get", cancellationToken: token);
                        result = await context.AppDock.CallAsync("commands.execute", new { id = "appdock.settings.update", args = new { changes = new { closeToTray = false }, expectedRevision = current.GetProperty("revision").GetString() } }, token);
                    } else if (action == "self") {
                        result = await context.AppDock.CallAsync("commands.execute", new { id = "appdock.applets." + context.ExtensionId + ".restart" }, token);
                    } else {
                        await context.Settings.SetAsync("flag", true, token);
                        await context.Settings.SetAsync("privateFlag", true, token);
                        result = new { ok = true };
                    }
                } catch (AppDockApiException error) { result = new { code = error.Code }; }
                await context.Log.InfoAsync("probe:" + action + ":" + JsonSerializer.Serialize(result), token);
            });
    }
}
