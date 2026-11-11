$iterations = 310000
$salt = New-Object byte[] 16

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($salt)
$rng.Dispose()

$securePassword = Read-Host "Voer je gekozen beheerderswachtwoord in" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
        $password,
        $salt,
        $iterations,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256
    )

    $hash = $derive.GetBytes(32)
    $derive.Dispose()

    $saltHex = [BitConverter]::ToString($salt).Replace("-", "").ToLower()
    $hashHex = [BitConverter]::ToString($hash).Replace("-", "").ToLower()

    Write-Host ""
    Write-Host "Je wachtwoordhash:"
    Write-Host "pbkdf2`$$iterations`$$saltHex`$$hashHex" -ForegroundColor Green
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $password = $null
    $securePassword.Dispose()
}
