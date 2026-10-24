@echo off
cd "c:\Users\tusha\OneDrive\Desktop\HOSTEL MANAGEMENT SYSTEM\hostel-management-system"
npm run build 2>&1
echo.
echo Build complete. Exit code: %errorlevel%
pause