@echo off
setlocal
cd /d "%~dp0"
title EmoAcademy - DAiSEE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-daisee.ps1"
if errorlevel 1 pause
