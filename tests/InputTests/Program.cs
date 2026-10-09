using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using AppDock.Runtime;
using System.Windows.Forms;

internal static class Program
{
    private static int failures;
    [STAThread] static int Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        if(args is ["--send",var handle,var action]) {
            var sendCursor=Cursor.Position;
            try {
                nint window;
                if (handle.StartsWith("pid:")) {
                    var pid=int.Parse(handle[4..]); window=GetForegroundWindow();
                    GetWindowThreadProcessId(window,out var foregroundPid);
                    if (foregroundPid!=pid) window=Process.GetProcessById(pid).MainWindowHandle;
                } else window=new nint(long.Parse(handle));
                SetForegroundWindow(window);Thread.Sleep(150);
                if(GetForegroundWindow()!=window) throw new Exception($"Input target {handle}/{window} did not become foreground (actual {GetForegroundWindow()}).");
                GetWindowRect(window,out var rect);Cursor.Position=new(rect.Left+350,rect.Top+330);Thread.Sleep(40);Mouse(8);Thread.Sleep(50);
                if(action=="move-left")Cursor.Position=new(Cursor.Position.X-85,Cursor.Position.Y);
                else if(action=="key:A"){Key(0x41);Thread.Sleep(80);Key(0x41,true);}
                else if(action=="key:Ctrl+A"){Key(0x11);Thread.Sleep(20);Key(0x41);Thread.Sleep(80);Key(0x41,true);Key(0x11,true);}
                else if(action=="click-left"){Mouse(2);Thread.Sleep(80);Mouse(4);}
                else if(action=="wheel-up")Mouse(0x800,120);
                Thread.Sleep(100);Mouse(16);Thread.Sleep(150);return 0;
            }finally{Mouse(16);Cursor.Position=sendCursor;}
        }
        using var form=new Probe(); form.Text="AppDock isolated gesture test";form.StartPosition=FormStartPosition.CenterScreen;form.Size=new(720,500);
        var original=Cursor.Position;
        form.Shown+=async(_,_)=>{try{await Run(form,args[0]);}catch(Exception e){Console.Error.WriteLine(e);failures++;}finally{Mouse(0x10);Mouse(0x04);Mouse(0x40);Key(0x41,true);Cursor.Position=original;form.Close();}};
        Application.Run(form);return failures==0?0:1;
    }
    private static async Task Run(Probe form,string helper)
    {
        using var child=Process.Start(new ProcessStartInfo(helper){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true})!;
        var errors=child.StandardError.ReadToEndAsync();
        await using var peer=new JsonRpcConnection(child.StandardOutput,child.StandardInput);
        var invocations=new List<string>();var cancellations=0;var delay=0;
        var reading=peer.ReadAsync(async(method,p)=>{
            if(method=="gestures.cancel"){Interlocked.Increment(ref cancellations);return null;}
            if(method!="gestures.invoke")throw new Exception(method);
            lock(invocations)invocations.Add(p.GetProperty("gesture").GetString()!);
            if(delay>0)await Task.Delay(delay);
            return null;
        });
        int Count(){lock(invocations)return invocations.Count;}
        async Task Sync(string scope="global",string[]? excluded=null,bool enabled=true,int interval=0,string window=""){
            var triggers=new[]{"move-up","move-down","move-left","move-right","click-left","click-middle","wheel-up","wheel-down","key:A"};
            var process=Process.GetCurrentProcess().ProcessName.ToLowerInvariant();
            await peer.RequestAsync("gestures.sync",new{enabled,browsers=new[]{process},excludedProcesses=excluded??[],requireChromiumWindowClass=false,distance=30,wheelDelayMs=interval,indicatorOpacity=.45,indicatorPosition="gesture-start",context="test",revision=1,
                rows=triggers.Select((g,i)=>new{id="r"+i,command="test.run",gesture=g,title="Test "+g,window,when=new{scope,appletIds=Array.Empty<string>(),processes=new[]{process}}}).ToArray()},CancellationToken.None);
            await Task.Delay(70);
        }
        async Task Begin(){form.Activate();SetForegroundWindow(form.Handle);await Task.Delay(80);Cursor.Position=form.PointToScreen(new(330,220));Mouse(8);await Task.Delay(25);}
        async Task End(){Mouse(16);await Task.Delay(150);}
        void Check(bool condition,string name){Console.WriteLine((condition?"PASS ":"FAIL ")+name);if(!condition)failures++;}
        try{
            await Sync();
            var n=Count();await Begin();Cursor.Position=new(Cursor.Position.X-80,Cursor.Position.Y);await Task.Delay(70);await End();Check(Count()==n+1 && invocations[^1]=="move-left","single stroke on release");
            var right=form.RightUps;await Begin();await End();Check(form.RightUps==right+1,"ordinary right click replay");
            n=Count();await Begin();Cursor.Position=new(Cursor.Position.X-80,Cursor.Position.Y);await Task.Delay(30);Cursor.Position=new(Cursor.Position.X,Cursor.Position.Y-80);await Task.Delay(40);await End();Check(Count()==n,"direction change cancels");
            n=Count();var left=form.LeftUps;await Begin();Mouse(2);await Task.Delay(100);await End();Mouse(4);await Task.Delay(60);Check(Count()==n+1 && form.LeftUps==left,"left click and release after right are consumed");
            n=Count();await Begin();Mouse(0x20);await Task.Delay(80);Mouse(0x40);await End();Check(Count()==n+1 && invocations[^1]=="click-middle","middle click");
            n=Count();var key=form.Keys;await Begin();Key(0x41);Key(0x41);await Task.Delay(80);await End();Key(0x41,true);await Task.Delay(50);Check(Count()==n+1 && form.Keys==key,"key repeat and paired key-up consumed");
            key=form.Keys;Key(0x41);Key(0x41,true);await Task.Delay(60);Check(form.Keys>key,"ordinary key passes outside gesture");
            n=Count();await Begin();Mouse(0x800,60);await Task.Delay(20);Mouse(0x800,60);await Task.Delay(60);Mouse(0x800,-120);await Task.Delay(60);await End();Check(Count()==n+2,"high-resolution wheel accumulation and reverse direction");
            await Sync(interval:400);n=Count();await Begin();Mouse(0x800,120);await Task.Delay(90);Mouse(0x800,-120);await Task.Delay(100);await End();Check(Count()==n+1,"wheel cooldown drops rather than queues");
            await Sync();delay=250;n=Count();await Begin();Mouse(0x800,120);await Task.Delay(30);for(var i=0;i<5;i++)Mouse(0x800,120);await End();await Task.Delay(300);Check(Count()==n+1,"busy wheel has no backlog");delay=0;
            n=Count();await Begin();await Sync(enabled:false);Cursor.Position=new(Cursor.Position.X-80,Cursor.Position.Y);await End();Check(Count()==n,"settings change cancels waiting gesture");
            await Sync(excluded:[Process.GetCurrentProcess().ProcessName.ToLowerInvariant()]);n=Count();right=form.RightUps;await Begin();await End();Check(Count()==n && form.RightUps==right+1,"excluded process passes normal clicks");
            await Sync(scope:"browser");n=Count();await Begin();Mouse(0x800,120);await Task.Delay(80);await End();Check(Count()==n+1,"browser process condition without Chromium restriction");
            await Sync(scope:"exe");n=Count();await Begin();Mouse(0x20);await Task.Delay(80);Mouse(0x40);await End();Check(Count()==n+1,"specified exe condition");
            await Sync(window:"1");n=Count();await Begin();Mouse(0x800,120);await End();Check(Count()==n,"wrong host window never captures");
            await Sync();n=Count();await Begin();using(var other=new Probe()){other.Show();other.Activate();SetForegroundWindow(other.Handle);await Task.Delay(80);Mouse(0x800,120);await End();}Check(Count()==n,"foreground change cancels");
            Check(cancellations>0,"session cancellation notifications");
        }finally{child.StandardInput.Close();await reading;await child.WaitForExitAsync();Console.Write(await errors);}
    }
    private sealed class Probe:Form {public int RightUps,LeftUps,Keys;protected override void WndProc(ref Message m){if(m.Msg==0x205)RightUps++;if(m.Msg==0x202)LeftUps++;if(m.Msg==0x100)Keys++;base.WndProc(ref m);}}
    private static void Mouse(uint flags,int data=0){if(SendInput(1,[new(){Union=new(){Mouse=new(){Flags=flags,Data=unchecked((uint)data)}}}],Marshal.SizeOf<Input>())!=1)throw new Exception("SendInput mouse failed: "+Marshal.GetLastWin32Error());}
    private static void Key(ushort key,bool up=false)=>SendInput(1,[new(){Type=1,Union=new(){Key=new(){Key=key,Flags=up?2u:0}}}],Marshal.SizeOf<Input>());
    [StructLayout(LayoutKind.Sequential)]private struct Input{public uint Type;public Union Union;}
    [StructLayout(LayoutKind.Explicit)]private struct Union{[FieldOffset(0)]public MouseEvent Mouse;[FieldOffset(0)]public KeyEvent Key;}
    [StructLayout(LayoutKind.Sequential)]private struct MouseEvent{public int X,Y;public uint Data,Flags,Time;public nuint Extra;}
    [StructLayout(LayoutKind.Sequential)]private struct KeyEvent{public ushort Key,Scan;public uint Flags,Time;public nuint Extra;}
    [DllImport("user32.dll",SetLastError=true)]private static extern uint SendInput(uint count,Input[] inputs,int size);
    [DllImport("user32.dll")]private static extern bool SetForegroundWindow(nint handle);
    [DllImport("user32.dll")]private static extern nint GetForegroundWindow();
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(nint handle,out uint pid);
    [StructLayout(LayoutKind.Sequential)]private struct Rect{public int Left,Top,Right,Bottom;}
    [DllImport("user32.dll")]private static extern bool GetWindowRect(nint handle,out Rect rect);
}
