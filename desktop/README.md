# EisenVaultSync

## Build

Run `npm run i-mac` to build the project for macos.
Run `npm run i-linux` to build the project for linux.

## Windows
- Download and install MSVC++ Build tools https://www.dropbox.com/s/mg9bi8z4luoutzf/VisualCppBuildTools_Full.exe?dl=0
 or https://visualstudio.microsoft.com/visual-cpp-build-tools/
- `npm install --global --production windows-build-tools`
- `$env:path="$env:Path;C:\Python27"`
- `npm config set msvs_version 2017`
- `npm install`
- `npm run rebuild`
- Generate a certificate first `npm run make-win-cert`
- Move `eisenvault.pfx` file under `certificates` folder
- Run `npm run i-win` to build the installer.
