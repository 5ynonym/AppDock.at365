param([int]$X, [int]$Y, [int]$Width = 180, [int]$Height = 120, [Parameter(Mandatory)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WidgetScreenCapture {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][WidgetScreenCapture]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$taskBitmap = [Drawing.Bitmap]::new($Width, $Height)
$taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
try {
    $taskGraphics.CopyFromScreen($X, $Y, 0, 0, $taskBitmap.Size)
    $taskBitmap.Save($OutputPath, [Drawing.Imaging.ImageFormat]::Png)
    $taskGreen = 0
    $taskMagenta = 0
    $taskBlack = 0
    for ($taskY = 0; $taskY -lt $Height; $taskY++) {
        for ($taskX = 0; $taskX -lt $Width; $taskX++) {
            $taskPixel = $taskBitmap.GetPixel($taskX, $taskY)
            # Allow the display's colour management/HDR transform; verify hue over the whole patch.
            if ($taskPixel.G -gt 140 -and $taskPixel.G - $taskPixel.R -gt 40 -and $taskPixel.G - $taskPixel.B -gt 10) { $taskGreen++ }
            if ($taskPixel.R -gt 180 -and $taskPixel.G -lt 70 -and $taskPixel.B -gt 100) { $taskMagenta++ }
            if ($taskPixel.R -lt 55 -and $taskPixel.G -lt 55 -and $taskPixel.B -lt 55) { $taskBlack++ }
        }
    }
    @{ green = $taskGreen; magenta = $taskMagenta; black = $taskBlack; pixels = $Width * $Height } | ConvertTo-Json -Compress
}
finally {
    $taskGraphics.Dispose()
    $taskBitmap.Dispose()
}
