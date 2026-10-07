param()
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class WidgetShellProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; public Point(int x, int y) { X=x; Y=y; } }
  public delegate bool Callback(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr parameter);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr window, uint command);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flag);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder value, int size);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
  public static string ClassName(IntPtr window) { var name = new StringBuilder(256); GetClassName(window, name, name.Capacity); return name.ToString(); }
  public static List<IntPtr> ShellWindows() {
    var result = new List<IntPtr>();
    EnumWindows((window, _) => { var name = ClassName(window); if (name == "Progman" || name == "WorkerW") result.Add(window); return true; }, IntPtr.Zero);
    return result;
  }
  public static List<Rect> ExposedDesktopRegions() {
    var result = new List<Rect>();
    int left=GetSystemMetrics(76), top=GetSystemMetrics(77), right=left+GetSystemMetrics(78), bottom=top+GetSystemMetrics(79);
    for (int y=top+40; y+120<bottom; y+=200) for (int x=left+40; x+180<right; x+=240) {
      bool desktop = true;
      foreach (var p in new[] { new Point(x,y), new Point(x+179,y), new Point(x,y+119), new Point(x+179,y+119), new Point(x+90,y+60) }) {
        var name = ClassName(GetAncestor(WindowFromPoint(p), 2));
        if (name != "Progman" && name != "WorkerW") { desktop = false; break; }
      }
      if (desktop) result.Add(new Rect { Left=x, Top=y, Right=x+180, Bottom=y+120 });
    }
    return result;
  }
}
'@
[void][WidgetShellProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
function Read-WidgetShellWindow([IntPtr]$taskWindow, [int]$depth = 0) {
    $taskRect = [WidgetShellProbe+Rect]::new()
    [void][WidgetShellProbe]::GetWindowRect($taskWindow, [ref]$taskRect)
    $taskCloaked = 0
    [void][WidgetShellProbe]::DwmGetWindowAttribute($taskWindow, 14, [ref]$taskCloaked, 4)
    $taskChildren = @()
    if ($depth -lt 3) {
        $taskChild = [WidgetShellProbe]::GetWindow($taskWindow, 5)
        while ($taskChild -ne [IntPtr]::Zero) {
            $taskChildren += Read-WidgetShellWindow $taskChild ($depth + 1)
            $taskChild = [WidgetShellProbe]::GetWindow($taskChild, 2)
        }
    }
    @{
        handle = $taskWindow.ToInt64().ToString()
        class = [WidgetShellProbe]::ClassName($taskWindow)
        visible = [WidgetShellProbe]::IsWindowVisible($taskWindow)
        cloaked = $taskCloaked
        style = [WidgetShellProbe]::GetWindowLongPtr($taskWindow, -16).ToInt64().ToString('X')
        extended = [WidgetShellProbe]::GetWindowLongPtr($taskWindow, -20).ToInt64().ToString('X')
        rectangle = @{ x = $taskRect.Left; y = $taskRect.Top; width = $taskRect.Right - $taskRect.Left; height = $taskRect.Bottom - $taskRect.Top }
        children = $taskChildren
    }
}
@{
    windows = @([WidgetShellProbe]::ShellWindows() | ForEach-Object { Read-WidgetShellWindow $_ })
    exposed = @([WidgetShellProbe]::ExposedDesktopRegions() | ForEach-Object { @{ x=$_.Left; y=$_.Top; width=$_.Right-$_.Left; height=$_.Bottom-$_.Top } })
} | ConvertTo-Json -Depth 20 -Compress
