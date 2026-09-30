@echo off
setlocal
cd /d "%~dp0"
call opencode.cmd --model openrouter/deepseek/deepseek-v4.1-flash --agent build
if errorlevel 1 pause
