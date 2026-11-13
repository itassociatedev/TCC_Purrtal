$projectPath = $PSScriptRoot
$phpPath = 'C:\php84\php.exe'
$routerPath = Join-Path $projectPath 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'

if (!(Get-NetTCPConnection -LocalPort 8011 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process $phpPath -ArgumentList "-S 127.0.0.1:8011 `"$routerPath`"" -WorkingDirectory (Join-Path $projectPath 'public') -WindowStyle Hidden
}
if (!(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process (Get-Command node).Source -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory $projectPath -WindowStyle Hidden
}
Write-Host 'Open http://127.0.0.1:8011. Saved frontend changes update automatically while these servers run.'
