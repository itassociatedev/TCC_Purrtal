$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskProject
Write-Host 'Connect Gmail for one test email. Your normal Google password will not work.'
Write-Host 'Create a Google App Password at https://myaccount.google.com/apppasswords'
$taskSecret = Read-Host 'Google App Password (hidden)' -AsSecureString
$taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecret)
try {
    $taskPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer).Replace(' ', '')
    if ($taskPassword -notmatch '^[A-Za-z0-9]{16}$') { throw 'Enter the 16-character Google App Password, not your normal password.' }
    $taskEnvPath = Join-Path $taskProject '.env'
    $taskEnv = [IO.File]::ReadAllText($taskEnvPath)
    $taskValues = @{
        TASK_MAILER = 'task-gmail'
        TASK_GMAIL_USERNAME = 'santos.david.1219@gmail.com'
        TASK_GMAIL_APP_PASSWORD = $taskPassword
        TASK_TEST_EMAIL = 'santos.david.1219@gmail.com'
        TASK_EMAIL_MODE = 'log'
    }
    foreach ($taskKey in $taskValues.Keys) {
        $taskLine = $taskKey + '=' + $taskValues[$taskKey]
        $taskPattern = '(?m)^' + [regex]::Escape($taskKey) + '=.*$'
        if ([regex]::IsMatch($taskEnv, $taskPattern)) { $taskEnv = [regex]::Replace($taskEnv, $taskPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $taskLine }) }
        else { $taskEnv = $taskEnv.TrimEnd() + "`r`n" + $taskLine + "`r`n" }
    }
    [IO.File]::WriteAllText($taskEnvPath, $taskEnv, [Text.UTF8Encoding]::new($false))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    $taskPassword = $null; $taskEnv = $null; $taskValues = $null
    $taskSecret.Dispose()
}
php -d extension=pdo_mysql artisan config:clear
if ($LASTEXITCODE -ne 0) { throw 'Could not reload configuration.' }
php -d extension=pdo_mysql artisan tasks:email-test --send
if ($LASTEXITCODE -ne 0) { throw 'The test was not sent. Check the error above.' }
Write-Host 'One test email submitted to Gmail. Check Inbox and Spam. Other task emails remain in log-only mode.'
