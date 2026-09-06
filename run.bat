@echo off
setlocal
pushd "%~dp0"
REM Forge requires a configured set of both JVM and program arguments.
REM Add custom JVM arguments to the user_jvm_args.txt
REM Add custom program arguments {such as nogui} to this file in the next line before the %* or
REM  pass them to this script directly
set "SERVER_JAVA=java"
if exist ".runtime\jdk-21.0.12.1+1-jre\bin\java.exe" set "SERVER_JAVA=.runtime\jdk-21.0.12.1+1-jre\bin\java.exe"
"%SERVER_JAVA%" @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.238/win_args.txt nogui %*
popd
pause
endlocal
