param(
    [string]$Database = 'vetclinic',
    [string]$HostName = 'localhost',
    [int]$Port = 3306,
    [string]$MysqlDumpPath = 'C:\xampp\mysql\bin\mysqldump.exe',
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE 'Documents\VetClinicBackups')
)

$username = $env:DB_USERNAME
if ([string]::IsNullOrWhiteSpace($username)) {
    throw 'Set DB_USERNAME to the database account used for the clinic database.'
}
if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    throw 'Database must contain only letters, numbers, and underscores.'
}
if (-not (Test-Path -LiteralPath $MysqlDumpPath -PathType Leaf)) {
    throw "mysqldump was not found at '$MysqlDumpPath'. Pass its path with -MysqlDumpPath."
}

function ConvertTo-MySqlOptionValue([string]$Value) {
    $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
    $escaped = $escaped.Replace("`r", '\r').Replace("`n", '\n')
    return '"' + $escaped + '"'
}

$backupDirectoryPath = [System.IO.Path]::GetFullPath($BackupDirectory)
New-Item -ItemType Directory -Path $backupDirectoryPath -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $backupDirectoryPath "$Database-$timestamp.sql"
$credentialsPath = Join-Path $env:TEMP ("vetclinic-mysqldump-" + [guid]::NewGuid().ToString('N') + '.cnf')
$password = $env:DB_PASSWORD
if ($null -eq $password) { $password = '' }

try {
    $config = @(
        '[client]'
        "host=$(ConvertTo-MySqlOptionValue $HostName)"
        "port=$Port"
        "user=$(ConvertTo-MySqlOptionValue $username)"
        "password=$(ConvertTo-MySqlOptionValue $password)"
    ) -join "`r`n"
    [System.IO.File]::WriteAllText(
        $credentialsPath,
        $config,
        (New-Object System.Text.UTF8Encoding($false))
    )

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $access = New-Object System.Security.AccessControl.FileSecurity
    $access.SetAccessRuleProtection($true, $false)
    $access.SetOwner($identity.User)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity.User,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        [System.Security.AccessControl.AccessControlType]::Allow
    )
    $access.AddAccessRule($rule)
    Set-Acl -LiteralPath $credentialsPath -AclObject $access

    & $MysqlDumpPath "--defaults-extra-file=$credentialsPath" `
        --single-transaction --routines --triggers $Database `
        "--result-file=$backupPath"
    if ($LASTEXITCODE -ne 0) {
        if (Test-Path -LiteralPath $backupPath) {
            Remove-Item -LiteralPath $backupPath -Force
        }
        throw "mysqldump failed with exit code $LASTEXITCODE."
    }
    $backupExists = Test-Path -LiteralPath $backupPath -PathType Leaf
    if (-not $backupExists -or (Get-Item -LiteralPath $backupPath).Length -eq 0) {
        throw 'mysqldump completed without creating a non-empty backup.'
    }

    Write-Output "Database backup created: $backupPath"
} finally {
    if (Test-Path -LiteralPath $credentialsPath) {
        Remove-Item -LiteralPath $credentialsPath -Force
    }
}
