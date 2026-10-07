param([Parameter(Mandatory)][string]$WindowHandle)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class WidgetNativeProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder value, int size);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][WidgetNativeProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$taskWindow = [IntPtr]::new([long]::Parse($WindowHandle))
$taskParent = [WidgetNativeProbe]::GetParent($taskWindow)
$taskClass = [Text.StringBuilder]::new(256)
[void][WidgetNativeProbe]::GetClassName($taskParent, $taskClass, 256)
$taskStyles = [WidgetNativeProbe]::GetWindowLongPtr($taskWindow, -16).ToInt64()
$taskExtended = [WidgetNativeProbe]::GetWindowLongPtr($taskWindow, -20).ToInt64()
$taskRect = [WidgetNativeProbe+Rect]::new()
[void][WidgetNativeProbe]::GetWindowRect($taskWindow, [ref]$taskRect)
@{
    parent = $taskParent.ToInt64().ToString()
    parentClass = $taskClass.ToString()
    child = ($taskStyles -band 0x40000000) -ne 0
    clickThrough = ($taskExtended -band 0x20) -ne 0
    noActivate = ($taskExtended -band 0x8000000) -ne 0
    layered = ($taskExtended -band 0x80000) -ne 0
    topmost = ($taskExtended -band 8) -ne 0
    foreground = [WidgetNativeProbe]::GetForegroundWindow().ToInt64().ToString()
    rectangle = @{ x = $taskRect.Left; y = $taskRect.Top; width = $taskRect.Right - $taskRect.Left; height = $taskRect.Bottom - $taskRect.Top }
} | ConvertTo-Json -Depth 5 -Compress
