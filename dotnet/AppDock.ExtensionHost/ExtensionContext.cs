using System.Collections.Concurrent;
using System.Text.Json;
using AppDock.SDK;

namespace AppDock.ExtensionHost;

internal sealed class ExtensionContext(string id, JsonElement settings, JsonRpcConnection connection, CancellationToken lifetime) :
    IExtensionContext, ICommandService, ITrayService, ISettingsService, INotificationService,
    IUiService, IBrowserService, ILogService, IStorageService, ISecretService, ISchedulerService, IAsyncDisposable
{
    private readonly ConcurrentDictionary<string, (string Title, Func<CancellationToken, Task> Handler)> commands = new();
    private readonly List<object> tray = [];
    private readonly List<ScheduledTask> schedules = [];
    private readonly SemaphoreSlim commandLock = new(1, 1);
    private JsonElement configuration = settings;
    private readonly object sync = new();
    public string ExtensionId => id;
    public ICommandService Commands => this;
    public ITrayService Tray => this;
    public ISettingsService Settings => this;
    public INotificationService Notifications => this;
    public IUiService Ui => this;
    public IBrowserService Browser => this;
    public ILogService Log => this;
    public IStorageService Storage => this;
    public ISecretService Secrets => this;
    public ISchedulerService Scheduler => this;
    public object Contributions => new { commands = commands.Select(c => new { id = c.Key, title = c.Value.Title }).ToArray(), tray };
    public void Register(string commandId, string title, Func<CancellationToken, Task> handler)
    {
        if (!commandId.StartsWith(id + ".", StringComparison.Ordinal)) throw new ArgumentException("Command ID must start with the extension ID.");
        if (!commands.TryAdd(commandId, (title, handler))) throw new ArgumentException("Duplicate command ID.");
    }
    public void Add(string title, string command) => tray.Add(new { title, command });
    public void ChangeSettings(JsonElement value) { lock (sync) configuration = value.Clone(); }
    public T Get<T>(string key, T fallback)
    {
        lock (sync)
        {
            if (!configuration.TryGetProperty(key, out var value)) return fallback;
            try { return value.Deserialize<T>(JsonRpcConnection.Json) ?? fallback; }
            catch (JsonException) { return fallback; }
        }
    }
    public Task SetAsync<T>(string key, T value, CancellationToken cancellationToken = default) => CallAsync("host.settings.set", new { key, value }, cancellationToken);
    public Task ShowAsync(string title, string body, CancellationToken cancellationToken = default) => CallAsync("host.notifications.show", new { title, body }, cancellationToken);
    public Task ShowPanelAsync(Panel panel, CancellationToken cancellationToken = default) => CallAsync("host.ui.panel", panel, cancellationToken);
    public Task OpenAsync(string url, CancellationToken cancellationToken = default) => CallAsync("host.browser.open", new { url }, cancellationToken);
    public Task InfoAsync(string message, CancellationToken cancellationToken = default) => CallAsync("host.log", new { level = "info", message }, cancellationToken);
    public Task ErrorAsync(string message, CancellationToken cancellationToken = default) => CallAsync("host.log", new { level = "error", message }, cancellationToken);
    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var result = await connection.RequestAsync("host.storage.get", new { key }, cancellationToken);
        return result.ValueKind == JsonValueKind.Null ? default : result.Deserialize<T>(JsonRpcConnection.Json);
    }
    Task IStorageService.SetAsync<T>(string key, T value, CancellationToken cancellationToken) => CallAsync("host.storage.set", new { key, value }, cancellationToken);
    async Task<string?> ISecretService.GetAsync(string key, CancellationToken cancellationToken)
    {
        var result = await connection.RequestAsync("host.secrets.get", new { key }, cancellationToken);
        return result.ValueKind == JsonValueKind.Null ? null : result.GetString();
    }
    Task ISecretService.SetAsync(string key, string value, CancellationToken cancellationToken) => CallAsync("host.secrets.set", new { key, value }, cancellationToken);
    public Task DeleteAsync(string key, CancellationToken cancellationToken = default) => CallAsync("host.secrets.delete", new { key }, cancellationToken);
    private async Task CallAsync(string method, object value, CancellationToken token) => _ = await connection.RequestAsync(method, value, token);
    public async Task ExecuteAsync(string commandId)
    {
        if (!commands.TryGetValue(commandId, out var command)) throw new ArgumentException("Unknown command.");
        await commandLock.WaitAsync(lifetime);
        try { await command.Handler(lifetime); } finally { commandLock.Release(); }
    }
    public IDisposable Every(TimeSpan interval, Func<CancellationToken, Task> callback)
    {
        if (interval < TimeSpan.FromSeconds(1)) throw new ArgumentOutOfRangeException(nameof(interval));
        var scheduled = new ScheduledTask(interval, callback, lifetime, e => ErrorAsync(e.Message));
        lock (sync) schedules.Add(scheduled);
        return scheduled;
    }
    public async ValueTask DisposeAsync()
    {
        ScheduledTask[] current; lock (sync) current = schedules.ToArray();
        foreach (var scheduled in current) scheduled.Dispose();
        await Task.WhenAll(current.Select(s => s.Completion));
    }
    private sealed class ScheduledTask : IDisposable
    {
        private readonly CancellationTokenSource cancellation;
        public Task Completion { get; }
        public ScheduledTask(TimeSpan interval, Func<CancellationToken, Task> callback, CancellationToken lifetime, Func<Exception, Task> report)
        {
            cancellation = CancellationTokenSource.CreateLinkedTokenSource(lifetime);
            Completion = Task.Run(async () =>
            {
                using var timer = new PeriodicTimer(interval);
                try
                {
                    while (await timer.WaitForNextTickAsync(cancellation.Token))
                        try { await callback(cancellation.Token); }
                        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { break; }
                        catch (Exception e) { try { await report(e); } catch { Console.Error.WriteLine(e.Message); } }
                }
                catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
            });
        }
        public void Dispose() { cancellation.Cancel(); }
    }
}
