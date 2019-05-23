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
- Run `npm run i-win` to build the installer.

# Troubleshooting

**Scenario:** When running `npm run server`

**Error:** The module '...' was compiled against a different Node.js version using NODE_MODULE_VERSION 51. This version of Node.js requires NODE_MODULE_VERSION 57. Please try re-compiling or re-installing
the module.

**Solution:** `npm rebuild --update-binary`

---

**Scenario:** When running `npm run el`

**Error:** The module '...' was compiled against a different Node.js version using NODE_MODULE_VERSION 51. This version of Node.js requires NODE_MODULE_VERSION 57. Please try re-compiling or re-installing
the module.

**Solution:** `npm run elr`

---
