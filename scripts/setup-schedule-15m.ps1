# PowerShell script to setup Task Scheduler for auto-update every 15 minutes
# Run as Administrator: Right-click → Run with PowerShell (as Administrator)

$TaskName = "CockpitJSONUpdate15m"
$ScriptPath = "C:\Users\Orange1\.cursor\worktrees\cockpit\vmb\scripts\update-json-15m.bat"
$WorkingDir = "C:\Users\Orange1\.cursor\worktrees\cockpit\vmb"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click and select 'Run with PowerShell (as Administrator)'" -ForegroundColor Yellow
    pause
    exit 1
}

# Check if script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[ERROR] Script not found: $ScriptPath" -ForegroundColor Red
    pause
    exit 1
}

# Remove existing task if it exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "[WARNING] Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create action (run the batch file)
$Action = New-ScheduledTaskAction -Execute $ScriptPath -WorkingDirectory $WorkingDir

# Create trigger (every 15 minutes, starting now)
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 365)

# Create settings (run even if on battery, don't stop if going on battery)
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Create principal (run whether user is logged in or not)
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# Register the task
try {
    Register-ScheduledTask `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -TaskName $TaskName `
        -Description "Updates JSON data from PostgreSQL every 15 minutes and pushes to GitHub (like reference project)" `
        -Force

    Write-Host "[SUCCESS] Task '$TaskName' registered successfully!" -ForegroundColor Green
    Write-Host "   - Runs every 15 minutes" -ForegroundColor Cyan
    Write-Host "   - Script: $ScriptPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To verify:" -ForegroundColor Yellow
    Write-Host "   - Open Task Scheduler" -ForegroundColor White
    Write-Host "   - Look for task: '$TaskName'" -ForegroundColor White
    Write-Host ""
    Write-Host "To test manually:" -ForegroundColor Yellow
    Write-Host "   - Run: $ScriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Logs:" -ForegroundColor Yellow
    Write-Host "   - Check: $WorkingDir\update_15m_log.txt" -ForegroundColor White
} catch {
    Write-Host "[ERROR] Error creating task: $_" -ForegroundColor Red
    pause
    exit 1
}

pause
