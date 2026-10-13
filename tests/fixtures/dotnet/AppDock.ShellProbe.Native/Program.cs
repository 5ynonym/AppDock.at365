using AppDock.Runtime;
using AppDock.ShellProbe;
using System.Text;
Console.InputEncoding = Encoding.UTF8;
Console.OutputEncoding = new UTF8Encoding(false);
var wireOutput = Console.Out;
Console.SetOut(Console.Error);
await AppletSession.RunAsync(new ShellProbe(), Console.In, wireOutput);
