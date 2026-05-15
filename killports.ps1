# Kill all Node processes using ports 3001, 5173, 5174, 5175
$ports = @(3001, 5173, 5174, 5175)

foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Select-Object -First 1
    if ($process) {
        Write-Host "Killing process $process on port $port"
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Waiting 3 seconds for ports to be released..."
Start-Sleep -Seconds 3

Write-Host "Starting app..."
npm run dev
