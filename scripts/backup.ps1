# ==========================================
# Seva Maintenance System - PowerShell Backup
# ==========================================
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

npx tsx "$ScriptDir/backup.ts" @args
