using System.Text.Json;

namespace AppDock.SDK;

public interface IAppDockService
{
    Task<JsonElement> CallAsync(string method, object? parameters = null, CancellationToken cancellationToken = default);
}

public sealed class AppDockApiException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
