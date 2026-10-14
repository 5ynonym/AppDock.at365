using AppDock.SDK;
using AppDock.Runtime;
await AppletSession.RunAsync(new Fixture(), Console.In, Console.Out);
sealed class Fixture : IAppDockExtension
{
    public Task ActivateAsync(IExtensionContext c, CancellationToken ct) {
        c.Commands.Register("fixture.notifications.native.publish", "Native publish", async token => {
            var result = await c.Notifications.PublishAsync(new("message", "Native notification", "Native body", DedupeKey: "episode",
                HistoryText: new("Safe native", "Safe"), Actions: [new("act", "Native action", "fixture.notifications.native.action")]) { Silent = true }, token);
            await c.Storage.SetAsync("result", result, token);
        });
        c.Commands.Register("fixture.notifications.native.action", "Native action", token => c.Storage.SetAsync("acted", true, token));
        c.Commands.Register("fixture.notifications.native.policy", "Native policy", async token => {
            await c.Storage.SetAsync("policy", await c.Notifications.GetPolicyAsync("message", token), token);
        });
        c.Notifications.OnPolicyChanged(token => c.Storage.SetAsync("changed", true, token));
        return Task.CompletedTask;
    }
}
