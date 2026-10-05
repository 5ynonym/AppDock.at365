param([Parameter(Mandatory = $true)][byte]$VirtualKey)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class AppDockTestKey {
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION data; }
    [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort key, scan; public uint flags, time; public System.UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int x, y; public uint mouseData, flags, time; public System.UIntPtr extra; }
    [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
    public static void Press(byte key) {
        var inputs = new INPUT[] {
            new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = key } } },
            new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = key, flags = 2 } } }
        };
        var sent = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        if (sent != 2) throw new System.InvalidOperationException("SendInput failed: " + Marshal.GetLastWin32Error());
    }
}
'@
[AppDockTestKey]::Press($VirtualKey)
