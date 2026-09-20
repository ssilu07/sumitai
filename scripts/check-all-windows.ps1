Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint dwAffinity);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@

$procs = Get-Process -Name "electron" -ErrorAction SilentlyContinue
$pidList = [System.Collections.Generic.List[int]]::new()
foreach ($p in $procs) { $pidList.Add([int]$p.Id) }

[WinUtil]::EnumWindows([WinUtil+EnumWindowsProc]{
  param($hwnd, $lparam)
  [uint32]$pId = 0
  [WinUtil]::GetWindowThreadProcessId($hwnd, [ref]$pId)
  if ($pidList.Contains([int]$pId)) {
    $vis = [WinUtil]::IsWindowVisible($hwnd)
    [uint32]$aff = 0
    [WinUtil]::GetWindowDisplayAffinity($hwnd, [ref]$aff)
    $sb = New-Object System.Text.StringBuilder 256
    [WinUtil]::GetWindowText($hwnd, $sb, 256)
    $title = $sb.ToString()
    Write-Host "HWND: $hwnd PID: $pId Visible: $vis Title: '$title' Affinity: 0x$($aff.ToString('X8'))"
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
