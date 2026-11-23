param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [Parameter(Mandatory = $true)]
    [string]$TargetDatabase,
    [string]$HostName = 'localhost',
    [int]$Port = 3306,
    [string]$MysqlPath = 'C:\xampp\mysql\bin\mysql.exe'
)

$username = $env:DB_USERNAME
if ([string]::IsNullOrWhiteSpace($username)) {
    throw 'Set DB_USERNAME to a database account with access to the pre-created restore database.'
}
if ($TargetDatabase -notmatch '^[A-Za-z0-9_]+_(restore|recovery)$') {
    throw 'Restore target must end in _restore or _recovery to prevent overwriting the live database.'
}
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile -ErrorAction Stop).Path
if ([System.IO.Path]::GetExtension($resolvedBackup) -ne '.sql') {
    throw 'Backup file must be a .sql file.'
}
if (-not (Test-Path -LiteralPath $MysqlPath -PathType Leaf)) {
    throw "mysql was not found at '$MysqlPath'. Pass its path with -MysqlPath."
}

function ConvertTo-MySqlOptionValue([string]$Value) {
    $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
    $escaped = $escaped.Replace("`r", '\r').Replace("`n", '\n')
    return '"' + $escaped + '"'
}

$credentialsPath = Join-Path $env:TEMP ("vetclinic-mysql-" + [guid]::NewGuid().ToString('N') + '.cnf')
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

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $MysqlPath
    $startInfo.Arguments = "--defaults-extra-file=`"$credentialsPath`" --database=`"$TargetDatabase`""
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'Could not start the mysql client.'
    }

    $errorOutputTask = $process.StandardError.ReadToEndAsync()
    $source = [System.IO.File]::OpenRead($resolvedBackup)
    try {
        $buffer = New-Object byte[] 65536
        while (($read = $source.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $process.StandardInput.BaseStream.Write($buffer, 0, $read)
        }
    } finally {
        $source.Dispose()
        $process.StandardInput.Close()
    }
    $process.WaitForExit()
    $errorOutput = $errorOutputTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) {
        throw "mysql restore failed with exit code $($process.ExitCode): $errorOutput"
    }

    Write-Output "Backup restored into '$TargetDatabase'. Review the restored data before using it."
} finally {
    if (Test-Path -LiteralPath $credentialsPath) {
        Remove-Item -LiteralPath $credentialsPath -Force
    }
}
