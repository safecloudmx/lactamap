@echo off
echo Registering Admin User...
curl -X POST http://localhost:3000/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"lacta@wari.mx\", \"password\": \"testingtest\", \"role\": \"OWNER\"}"
echo.
echo.
echo Logging in to verify...
curl -X POST http://localhost:3000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"lacta@wari.mx\", \"password\": \"testingtest\"}"
echo.
pause
