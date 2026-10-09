namespace AppDock.SDK;

/// <summary>Host supplied invocation context. Ordinary command calls have no gesture context.</summary>
public sealed record CommandInvocation(string Session, string Window, string Process, string Source);
public static class CommandExecution
{
    private static readonly AsyncLocal<CommandInvocation?> current = new();
    public static CommandInvocation? Current { get => current.Value; set => current.Value = value; }
}
