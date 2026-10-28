# ==========================================
# Seva Maintenance System - PowerShell Restore
# ==========================================
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

npx tsx "$ScriptDir/restore.ts" @args
