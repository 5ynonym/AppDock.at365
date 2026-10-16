using AppDock.SDK;
namespace AppDock.RibbonBadge;
public sealed class Extension : IAppDockExtension
{
    public async Task ActivateAsync(IExtensionContext context, CancellationToken token)
    {
        context.Commands.Register("fixture.ribbon-dotnet.clear", "Clear native badge", ct => context.Ribbon.SetBadgeAsync(new() { PageId = "main" }, null, ct));
        await context.Ribbon.SetBadgeAsync(new() { PageId = "main" }, new() { Kind = "count", Count = 7, Label = "Native fixture" }, token);
    }
}
