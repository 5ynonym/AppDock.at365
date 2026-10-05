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
                        await context.ExecuteAsync(parameters.GetProperty("id").GetString()!);
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
