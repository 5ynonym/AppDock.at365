using AppDock.SDK;

namespace AppDock.Runtime;

/// <summary>Hosts a .NET Applet over AppDock's inherited stdin/stdout connection.</summary>
public static class AppletSession
{
    public static async Task RunAsync(IAppDockExtension applet, TextReader input, TextWriter output, CancellationToken cancellationToken = default)
    {
        await using var connection = new JsonRpcConnection(input, output);
        using var active = CancellationTokenSource.CreateLinkedTokenSource(connection.Lifetime, cancellationToken);
        ExtensionContext? context = null;
        var deactivated = false;
        var invocations = new System.Collections.Concurrent.ConcurrentDictionary<string, CancellationTokenSource>();
        // RPC handlers run concurrently: cancellation may arrive before command registration.
        var cancelledInvocations = new System.Collections.Concurrent.ConcurrentDictionary<string, byte>();
        var cancellationOrder = new System.Collections.Concurrent.ConcurrentQueue<string>();
        try
        {
            await connection.ReadAsync(async (method, parameters) =>
            {
                switch (method)
                {
                    case "activate":
                        if (context is not null) throw new InvalidOperationException("Already activated.");
                        context = new ExtensionContext(parameters.GetProperty("id").GetString()!, parameters.GetProperty("settings"), connection, active.Token);
                        await applet.ActivateAsync(context, active.Token);
                        return context.Contributions;
                    case "settings.changed":
                        if (context is not null) await context.ChangeSettingsAsync(parameters);
                        return null;
                    case "command.execute":
                        if (context is null) throw new InvalidOperationException("Not activated.");
                        var invocation = parameters.TryGetProperty("invocation", out var metadata)
                            ? System.Text.Json.JsonSerializer.Deserialize<CommandInvocation>(metadata, JsonRpcConnection.Json) : null;
                        using (var commandLifetime = CancellationTokenSource.CreateLinkedTokenSource(active.Token)) {
                            if (invocation is not null && !invocations.TryAdd(invocation.Session, commandLifetime))
                                throw new InvalidOperationException("Invocation already running.");
                            try {
                                if (invocation is not null && cancelledInvocations.ContainsKey(invocation.Session)) commandLifetime.Cancel();
                                CommandExecution.Current = invocation;
                                await context.ExecuteAsync(parameters.GetProperty("id").GetString()!, commandLifetime.Token);
                            } finally {
                                CommandExecution.Current = null;
                                if (invocation is not null) invocations.TryRemove(invocation.Session, out _);
                            }
                        }
                        return null;
                    case "command.cancel":
                        var cancelledSession = parameters.GetProperty("session").GetString()!;
                        if (cancelledInvocations.TryAdd(cancelledSession, 0)) cancellationOrder.Enqueue(cancelledSession);
                        while (cancelledInvocations.Count > 256 && cancellationOrder.TryDequeue(out var expired))
                            cancelledInvocations.TryRemove(expired, out _);
                        if (invocations.TryGetValue(cancelledSession, out var pending))
                            try { await pending.CancelAsync(); }
                            catch (ObjectDisposedException) { /* Command completed concurrently. */ }
                        return null;
                    case "panel.action":
                        if (context is null || applet is not IPanelActionHandler panelActions)
                            throw new InvalidOperationException("Panel actions are not supported.");
                        await panelActions.HandlePanelActionAsync(parameters.GetProperty("id").GetString()!, active.Token);
                        return null;
                    case "deactivate":
                        await active.CancelAsync();
                        if (context is not null) await context.DisposeAsync();
                        await applet.DeactivateAsync(CancellationToken.None);
                        deactivated = true;
                        return null;
                    default: throw new InvalidOperationException($"Unknown method: {method}");
                }
            });
        }
        finally
        {
            await active.CancelAsync();
            if (context is not null) await context.DisposeAsync();
            if (!deactivated) await applet.DeactivateAsync(CancellationToken.None);
        }
    }
}
