@echo off
setlocal
cd /d "%~dp0"
node.exe start.mjs
if errorlevel 1 pause
