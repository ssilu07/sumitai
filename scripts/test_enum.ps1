$code = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class TestWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint dwAffinity);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

  public static void Run() {
    EnumWindows((hWnd, lParam) => {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      try {
        var proc = Process.GetProcessById((int)pid);
        if (proc.ProcessName.ToLower().Contains("electron")) {
          uint affinity = 0;
          GetWindowDisplayAffinity(hWnd, out affinity);
          var sb = new System.Text.StringBuilder(256);
          GetWindowText(hWnd, sb, 256);
          Console.WriteLine("PID: " + pid + " HWND: " + hWnd + " Visible: " + IsWindowVisible(hWnd) + " Title: '" + sb.ToString() + "' Affinity: 0x" + affinity.ToString("X8"));
        }
      } catch {}
      return true;
    }, IntPtr.Zero);
  }
}
"@

Add-Type -TypeDefinition $code -Language CSharp
[TestWin]::Run()
