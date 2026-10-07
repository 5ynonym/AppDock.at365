namespace AppDock.SDK;

public interface IAppDockExtension
{
    Task ActivateAsync(IExtensionContext context, CancellationToken cancellationToken);
    Task DeactivateAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
public interface IPanelActionHandler
{
    Task HandlePanelActionAsync(string actionId, CancellationToken cancellationToken);
}
public interface IExtensionContext
{
    string ExtensionId { get; }
    ICommandService Commands { get; }
    ITrayService Tray { get; }
    ISettingsService Settings { get; }
    INotificationService Notifications { get; }
    IUiService Ui { get; }
    IBrowserService Browser { get; }
    ILogService Log { get; }
    IStorageService Storage { get; }
    ISecretService Secrets { get; }
    ISchedulerService Scheduler { get; }
    IWidgetService Widgets => throw new NotSupportedException("Widget services require AppDock 0.10.0.");
}
public interface IWidgetService
{
    Task ReplaceAsync(IReadOnlyList<WidgetDefinition> widgets, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, WidgetPlacement>> GetPlacementsAsync(CancellationToken cancellationToken = default);
    Task SetDesktopAsync(IReadOnlyList<string> ids, bool enabled, CancellationToken cancellationToken = default);
}
public sealed record WidgetDefinition(string Id, string Title, WidgetContent Content)
{
    public string? Description { get; init; }
    public string? FontFile { get; init; }
    public WidgetPlacement? InitialPlacement { get; init; }
}
public sealed record WidgetContent(string Kind)
{
    public bool? ShowSeconds { get; init; }
    public string? Locale { get; init; }
    public string? TimeZone { get; init; }
    public string? Body { get; init; }
    public IReadOnlyList<PanelFact>? Facts { get; init; }
}
public sealed record WidgetPlacement
{
    public bool Home { get; init; }
    public int Order { get; init; }
    public bool Desktop { get; init; }
    public string Monitor { get; init; } = "primary";
    public string Layer { get; init; } = "front";
    public string Position { get; init; } = "anchor";
    public string Anchor { get; init; } = "top-right";
    public double X { get; init; } = 20;
    public double Y { get; init; } = 20;
    public double Width { get; init; } = 360;
    public double Height { get; init; } = 160;
    public double FontSize { get; init; } = 80;
    public double Opacity { get; init; } = 0.8;
    public string Color { get; init; } = "#ffffff";
    public string HorizontalAlign { get; init; } = "auto";
    public string VerticalAlign { get; init; } = "auto";
}
public interface ICommandService
{
    void Register(string id, string title, Func<CancellationToken, Task> handler);
    Task ReplaceAsync(IReadOnlyList<CommandRegistration> commands, CancellationToken cancellationToken = default);
}
public sealed record CommandRegistration(string Id, string Title, Func<CancellationToken, Task> Handler);
public interface ITrayService { void Add(string title, string command); }
public interface ISettingsService
{
    T Get<T>(string key, T fallback);
    Task SetAsync<T>(string key, T value, CancellationToken cancellationToken = default);
    IDisposable OnChanged(Func<CancellationToken, Task> handler);
    Task SetOptionsAsync(string key, IReadOnlyList<SettingOption> options, CancellationToken cancellationToken = default);
}
public interface INotificationService { Task ShowAsync(string title, string body, CancellationToken cancellationToken = default); }
public interface IUiService {
    Task ShowPanelAsync(Panel panel, CancellationToken cancellationToken = default);
    Task<string> GetImageDirectoryAsync(CancellationToken cancellationToken = default);
}
public interface IBrowserService { Task OpenAsync(string url, CancellationToken cancellationToken = default); }
public interface ILogService
{
    Task InfoAsync(string message, CancellationToken cancellationToken = default);
    Task ErrorAsync(string message, CancellationToken cancellationToken = default);
}
public interface IStorageService
{
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    Task SetAsync<T>(string key, T value, CancellationToken cancellationToken = default);
}
public interface ISecretService
{
    Task<string?> GetAsync(string key, CancellationToken cancellationToken = default);
    Task SetAsync(string key, string value, CancellationToken cancellationToken = default);
    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}
public interface ISchedulerService
{
    // The next tick is skipped until the previous callback completes.
    IDisposable Every(TimeSpan interval, Func<CancellationToken, Task> callback);
}
public sealed record Panel(string Title, string? Description = null, IReadOnlyList<PanelFact>? Facts = null, IReadOnlyList<PanelAction>? Actions = null)
{
    public IReadOnlyList<PanelImage>? Images { get; init; }
    public IReadOnlyList<PanelAction>? Tabs { get; init; }
}
public sealed record PanelImage(string Title, string? Description = null, string? Image = null, IReadOnlyList<PanelAction>? Actions = null)
{
    public string? Tooltip { get; init; }
    public string? ImageFile { get; init; }
}
public sealed record PanelFact(string Label, string Value);
public sealed record PanelAction(string Title, string Command)
{
    public string? ActionId { get; init; }
    public bool? Selected { get; init; }
}
public sealed record SettingOption(string Label, string Value);
