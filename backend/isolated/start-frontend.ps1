$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../../frontend')
# Vite gives an existing process variable priority over .env.
$env:VITE_API_BASE_URL = 'http://localhost:8092/api/aima'
& npm run dev -- --host 127.0.0.1 --port 3100 --strictPort
exit $LASTEXITCODE
