@echo off
if not exist index.html cd ..
set DOCROOT=%CD%
pushd tools
set PORT=8000
start tiny.exe %DOCROOT% %PORT%
echo URL: http://localhost:%PORT%
popd