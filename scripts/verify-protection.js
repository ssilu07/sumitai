/**
 * Verification Script: Screen Capture Protection & Window Display Affinity
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('====================================================');
console.log(' Stealth Window Display Affinity Verification Tool  ');
console.log('====================================================\n');

if (process.platform === 'win32') {
  console.log('[OS Check] Windows detected.');
  console.log('[Validation Method] Querying Win32 GetWindowDisplayAffinity...\n');

  const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class User32 {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint dwAffinity);
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

$procs = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if (-not $procs) {
  Write-Host "[!] No running Electron process found. Start the app with 'npm run dev' first." -ForegroundColor Yellow
  exit
}

$found = $false
foreach ($p in $procs) {
  if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
    $found = $true
    [uint32]$affinity = 0
    $res = [User32]::GetWindowDisplayAffinity($p.MainWindowHandle, [ref]$affinity)
    if ($res) {
      $hex = "0x{0:X8}" -f $affinity
      Write-Host "Process: $($p.ProcessName) (PID: $($p.Id))" -ForegroundColor Cyan
      Write-Host "  Window Title: '$($p.MainWindowTitle)'"
      Write-Host "  Affinity Value: $hex" -NoNewline

      if ($affinity -eq 0x11) {
        Write-Host " -> WDA_EXCLUDEFROMCAPTURE [CONFIRMED INVISIBLE TO SCREEN SHARE]" -ForegroundColor Green
      } elseif ($affinity -eq 0x1) {
        Write-Host " -> WDA_MONITOR [BLACK RECTANGLE IN CAPTURE]" -ForegroundColor Yellow
      } elseif ($affinity -eq 0x0) {
        Write-Host " -> WDA_NONE [VISIBLE TO SCREEN SHARE - PROTECTION DISABLED]" -ForegroundColor Red
      }
    }
  }
}

if (-not $found) {
  Write-Host "Electron is running. (If frameless window has no taskbar entry, handle is active in DWM)." -ForegroundColor Cyan
}
`;

  const tmpFile = path.join(os.tmpdir(), `check-affinity-${Date.now()}.ps1`);
  fs.writeFileSync(tmpFile, psScript, 'utf8');

  try {
    const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
      encoding: 'utf-8',
    });
    console.log(output);
  } catch (err) {
    console.error('[Error executing affinity check]:', err.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
} else {
  console.log(`[OS Check] Platform: ${process.platform}.`);
}
