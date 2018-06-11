const electron = require("electron");
const url = require("url");
const path = require("path");
const server = require("./server/server");
const { app, BrowserWindow, Menu, Tray, ipcMain } = electron;
const AutoLaunch = require("auto-launch");
const notifier = require("electron-notifications");

// Set environment
process.env.NODE_ENV = "dev";

let mainWindow, tray;

let forceQuit = false;

ipcMain.on("autolaunch", (event, arg) => {
  const autoLauncher = new AutoLaunch({
    name: app.getName()
  });

  if (arg == 1) {
    autoLauncher.enable();
  } else {
    autoLauncher.disable();
  }
  event.returnValue = arg;
});

// Listen for app to be ready
app.on("ready", () => {
  // Create main window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 650,
    title: "Eisen Syncer - Syncing files made simple"
  });

  // Load system tray
  tray = new Tray(path.join(__dirname, "/src/assets/logos/rounded.png"));

  ipcMain.on("syncNotify", (event, arg) => {
    var eNotify = require("electron-notify");

    eNotify.notify({
      title: arg.title,
      text: arg.body
    });

    eNotify.setConfig({
      displayTime: 25000,
      width: 300,
      height: 100,
      padding: 0,
      appIcon: path.join(__dirname, "/src/assets/logos/rounded.png"),

      defaultStyleContainer: {
        backgroundColor: "#ffffff",
        overflow: "hidden",
        padding: 0,
        fontFamily: "Arial",
        fontSize: 14,
        position: "relative",
        lineHeight: "15px"
      },
      defaultStyleClose: {
        position: "absolute",
        top: 1,
        right: 3,
        fontSize: 11,
        color: "#000",
        cursor: "pointer"
      },
      defaultStyleText: {
        margin: 0,
        overflow: "hidden",
        cursor: "default",
        color: "#000000"
      },
      defaultWindow: {
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        frame: false,
        transparent: true,
        acceptFirstMouse: true
      }
    });
  });

  // Add tray context menu
  let trayMenuItems = [
    {
      label: "Syncing changes"
    },
    {
      label: "Add a remote folder",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/"
          })
        );
        mainWindow.show();
      }
    },
    {
      label: "Manage Accounts",
      click() {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname + "/dist/index.html"),
            protocol: "file:",
            slashes: true,
            hash: "/account/manage"
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
      label: "About " + app.getName(),
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
      label: "Exit",
      click() {
        forceQuit = true;
        app.quit();
      }
    }
  ];

  const trayMenu = Menu.buildFromTemplate(trayMenuItems);
  tray.setToolTip("Sync your files easily");
  tray.setContextMenu(trayMenu);

  // Load the html file into window
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname + "/dist/index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  mainWindow.on("close", function(e) {
    if (!forceQuit) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", function() {
    mainWindow = null;
    app.quit();
  });

  app.on("activate-with-no-open-windows", function() {
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

// Add dev-tools if not in production
if (process.env.NODE_ENV != "production") {
  mainMenuTemplate.push({
    label: "Developer",
    submenu: [
      {
        label: "Show Dev Tools",
        accelerator: process.platform == "darwin" ? "Command+I" : "Ctrl+I",
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
      {
        role: "reload"
      }
    ]
  });
}
