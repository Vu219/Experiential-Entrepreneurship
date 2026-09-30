$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Explicit config location replaces application.yml, so backend/.env is never imported.
& .\mvnw.cmd spring-boot:run '-Dspring-boot.run.jvmArguments=-Duser.timezone=Asia/Ho_Chi_Minh' '-Dspring-boot.run.arguments=--spring.config.location=file:./isolated/application.yml --spring.profiles.active=isolated'
exit $LASTEXITCODE
