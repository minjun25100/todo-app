@echo off
echo 🚀 할일 관리 서버 시작 중...
echo.
echo 📍 서버 주소: http://localhost:8080
echo ⏹️  서버 종료: Ctrl+C
echo.
cd /d "%~dp0"
npx http-server -p 8080 -c-1
pause 