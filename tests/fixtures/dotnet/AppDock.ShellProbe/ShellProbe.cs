using AppDock.SDK;
using System.Text.Json;
namespace AppDock.ShellProbe;
public sealed class ShellProbe : IAppDockExtension
{
    private IDisposable? subscription;
    public async Task ActivateAsync(IExtensionContext context, CancellationToken cancellationToken)
    {
        subscription = context.Shell.OnChanged(async (state, token) => await context.Log.InfoAsync("shell-change:" + JsonSerializer.Serialize(state, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }), token));
        var initial = await context.Shell.GetStateAsync(cancellationToken);
        await context.Log.InfoAsync("shell-activate:" + JsonSerializer.Serialize(initial, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }), cancellationToken);
        foreach (var command in new[] { "probe", "normal", "visible", "resolved" })
            context.Commands.Register(context.ExtensionId + "." + command, command, async token => {
                var state = await context.Shell.GetStateAsync(token);
                await context.Log.InfoAsync("shell-command:" + command + ":" + JsonSerializer.Serialize(state, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }), token);
            });
    }
    public Task DeactivateAsync(CancellationToken cancellationToken) { subscription?.Dispose(); subscription = null; return Task.CompletedTask; }
}
