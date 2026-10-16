using System.Text.Json.Serialization;

namespace AppDock.SDK;

public interface IRibbonService
{
    Task SetBadgeAsync(RibbonBadgeTarget target, RibbonBadge? badge, CancellationToken cancellationToken = default);
}
public sealed record RibbonBadgeTarget
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? PageId { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? CollectionKey { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? ItemId { get; init; }
}
public sealed record RibbonBadge
{
    public required string Kind { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public long? Count { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Label { get; init; }
}
