const electron = require("electron");
const { session } = require("electron");
const { app, BrowserWindow, Menu, Tray, ipcMain } = electron;
const url = require("url");
const path = require("path");
const AutoLaunch = require("auto-launch");
require("./server/server");

// Set environment
process.env.NODE_ENV = "dev";

let mainWindow, tray;
let forceQuit = false;

// Set the max memory size of the app
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

ipcMain.on("autolaunch", (event, arg) => {
  const autoLauncher = new AutoLaunch({
    name: app.getName()
  });

  autoLauncher.isEnabled()
    .then(function (isEnabled) {
      if (isEnabled) {
        event.returnValue = arg;
        return;
      }

      if (arg == 1) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
      event.returnValue = arg;
    })
    .catch(function (error) {
      console.log('autolaunch_error', error);
    });
});

// Listen for app to be ready
app.on("ready", () => {

  // Hide on taskbar for mac
  if (process.platform == "darwin") {
    // app.dock.hide();
  }

  // Patch to fix the "failed to load dev-tools issue". See https://github.com/electron/electron/issues/13008#issuecomment-400261941
  session.defaultSession.webRequest.onBeforeRequest({}, (details, callback) => {
    if (
      details.url.indexOf("7accc8730b0f99b5e7c0702ea89d1fa7c17bfe33") !== -1
    ) {
      callback({
        redirectURL: details.url.replace(
          "7accc8730b0f99b5e7c0702ea89d1fa7c17bfe33",
          "57c9d07b416b5a2ea23d28247300e4af36329bdc"
        )
      });
    } else {
      callback({ cancel: false });
    }
  });

  // Create main window
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 700,
    skipTaskbar: true,
    title: "EisenVaultSync - A two-way file sync desktop application for EisenVault DMS",
    show: false,
    icon: path.join(__dirname, "src/assets/logos/256.png"),
    webPreferences: {
      backgroundThrottling: false,
    }
  });

  // Load system tray
  tray = new Tray(path.join(__dirname, "/src/assets/logos/tray.png"));

  tray.on('right-click', () => {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname + "/dist/index.html"),
        protocol: "file:",
        slashes: true,
        hash: "/account/manage?cached=1"
      })
    );
    mainWindow.show();
  });

  // Blink the tray icon if the sync is in progress...
  var blinker = null;
  var on = false;
  ipcMain.on('isSyncing', (event, isSyncing) => {

    if (isSyncing === true && blinker === null) {
      blinker = setInterval(function () {
        if (on) {
          tray.setImage(path.join(__dirname, `/src/assets/logos/tray.png`));
        } else {
          tray.setImage(path.join(__dirname, `/src/assets/logos/tray_grey.png`));
        }
        on = !on;
      }, 500);
    }

    if (isSyncing === false) {
      clearInterval(blinker);
      blinker = null;
      tray.setImage(path.join(__dirname, `/src/assets/logos/tray.png`));
    }
  });

  // Add tray context menu
  let trayMenuItems = [
    {
      label: "Manage Accounts",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/account/manage?cached=1"
          })
        );
        mainWindow.show();
      }
    },
    {
      label: "Add a remote folder",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/account-new"
          })
        );
        mainWindow.show();
      }
    },
    {
      label: "Settings",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/settings"
          })
        );
        mainWindow.show();
      }
    },
    { type: "separator" },
    {
      label: "View Error Logs",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/logs/error"
          })
        );
        mainWindow.show();
      }
    },
    {
      label: "View Event Logs",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/logs/event"
          })
        );
        mainWindow.show();
      }
    },
    { type: "separator" },
    {
      label: "About EisenVaultSync",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/about"
          })
        );
        mainWindow.show();
      }
    },
    {
      label: "Developer",
      submenu: [
        {
          label: "Show Developer Tools",
          accelerator: process.platform == "darwin" ? "Command+I" : "Ctrl+I",
          click() {
            mainWindow.webContents.openDevTools();
          }
        }
      ]
    },
    { type: "separator" },
    {
      label: "Exit",
      click() {
        forceQuit = true;
        app.quit();
      }
    }
  ];

  const trayMenu = Menu.buildFromTemplate(trayMenuItems);
  tray.setToolTip("EisenVaultSync");
  tray.setContextMenu(trayMenu);

  // Load the html file into window
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname + "/dist/index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  mainWindow.on("close", function (e) {
    if (!forceQuit) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
    app.quit();
  });

  app.on("activate-with-no-open-windows", function () {
    mainWindow.show();
  });

  //   Buld the menu from template
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  // Insert Menu
  Menu.setApplicationMenu(mainMenu);
});

// Create menu template
const mainMenuTemplate = [];

// For mac, add empty object to menu
if (process.platform == "darwin") {
  mainMenuTemplate.unshift({});
}