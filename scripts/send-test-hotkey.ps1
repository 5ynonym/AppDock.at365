param([Parameter(Mandatory = $true)][byte]$VirtualKey, [switch]$Control, [switch]$Alt, [switch]$ScanCode)
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
    [DllImport("user32.dll")] private static extern uint MapVirtualKey(uint key, uint type);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    public static void Press(byte key, bool control, bool alt, bool scanCode) {
        // Do not release the user's held modifiers or send a different physical chord.
        var deadline = System.Diagnostics.Stopwatch.StartNew();
        while (true) {
            bool held = false;
            foreach (var candidate in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C, key })
                held |= (GetAsyncKeyState(candidate) & 0x8000) != 0;
            if (!held) break;
            if (deadline.ElapsedMilliseconds > 3000) throw new System.InvalidOperationException("A modifier or test key is physically held; input test deferred.");
            System.Threading.Thread.Sleep(10);
        }
        var inputs = new System.Collections.Generic.List<INPUT>();
        if (control) inputs.Add(new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = 0x11 } } });
        if (alt) inputs.Add(new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = 0x12 } } });
        inputs.AddRange(new INPUT[] {
            new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = key } } },
            new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = key, flags = 2 } } }
        });
        if (alt) inputs.Add(new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = 0x12, flags = 2 } } });
        if (control) inputs.Add(new INPUT { type = 1, data = new INPUTUNION { keyboard = new KEYBDINPUT { key = 0x11, flags = 2 } } });
        uint sent = 0;
        foreach (var input in inputs) {
            var prepared = input;
            if (scanCode) {
                var scan = MapVirtualKey(prepared.data.keyboard.key, 0);
                if (scan == 0) throw new System.InvalidOperationException("No scan code for the test key.");
                prepared.data.keyboard.scan = (ushort)scan;
                prepared.data.keyboard.key = 0;
                prepared.data.keyboard.flags |= 8; // KEYEVENTF_SCANCODE
            }
            sent += SendInput(1, new INPUT[] { prepared }, Marshal.SizeOf(typeof(INPUT)));
            System.Threading.Thread.Sleep(20);
        }
        if (sent != inputs.Count) throw new System.InvalidOperationException("SendInput failed: " + Marshal.GetLastWin32Error());
    }
}
'@
[AppDockTestKey]::Press($VirtualKey, $Control.IsPresent, $Alt.IsPresent, $ScanCode.IsPresent)
