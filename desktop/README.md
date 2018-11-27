# EisenSync

## Build

Run `npm run i-mac` to build the project for macos.
Run `npm run i-linux` to build the project for linux.

## Windows
- `npm install --global --production windows-build-tools`
- `npm install`
- `npm run rebuild`
- Generate a certificate first `npm run make-win-cert`
- Move `eisenvault.pfx` file under `certificates` folder
- Run `npm run i-win` to build the installer.
