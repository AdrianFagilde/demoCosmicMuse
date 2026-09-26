# Lanza el volcado del esquema de produccion.
# Uso:  powershell -ExecutionPolicy Bypass -File supabase\dump-schema.ps1
#
# Te pide la contrasena de la base de datos de forma oculta, la usa solo
# para este comando y la borra despues. No se escribe en el historial de
# PowerShell ni en ningun fichero.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$salida = 'supabase/baseline/schema-public.sql'
$carpeta = Split-Path $salida -Parent
if (-not (Test-Path $carpeta)) { New-Item -ItemType Directory -Force -Path $carpeta | Out-Null }

$seguro = Read-Host 'Contrasena de la base de datos' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
$plano = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

try {
    $env:SUPABASE_DB_PASSWORD = $plano
    supabase db dump --linked --schema public -f $salida
    $codigo = $LASTEXITCODE
}
finally {
    $env:SUPABASE_DB_PASSWORD = $null
    Remove-Variable plano -ErrorAction SilentlyContinue
}

if ($codigo -ne 0) { throw "db dump devolvio el codigo $codigo" }
Write-Host ''
Write-Host "OK  ->  $salida"
