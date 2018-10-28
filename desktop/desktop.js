const electron = require("electron");
const url = require("url");
const path = require("path");
var pm2 = require("pm2");
const { app, BrowserWindow, Menu, Tray, ipcMain } = electron;
const AutoLaunch = require("auto-launch");
const { session } = require("electron");
const { logger } = require("./server/helpers/logger");
const server = require("./server/server");

// Set environment
process.env.NODE_ENV = "dev";

// Start the backend server...
// pm2.connect(function(err) {
//   if (err) {
//     logger.info(`Unable to connect PM2: ${err}`);
//     process.exit(2);
//   }

//   pm2.start(
//     {
//       name: "eisensync",
//       script: "./server/server.js", // Script to be run
//       exec_mode: "cluster",
//       instances: 1,
//       max_memory_restart: "5000M", // Optional: Restarts your app if it reaches 5GB
//       noDaemonMode: true,
//       watch: true
//     },
//     function(err, apps) {
//       logger.info(`Unable to start PM2: ${err}`);
//       pm2.disconnect(); // Disconnects from PM2
//       if (err) throw err;
//     }
//   );
// });

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
    width: 1024,
    height: 650,
    title: "EisenSync - Syncing files made simple",
    icon: path.join(__dirname, "src/assets/logos/256.png")
  });

  // Load system tray
  tray = new Tray(path.join(__dirname, "/src/assets/logos/tray.png"));

  // Add tray context menu
  let trayMenuItems = [
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
      label: "About EisenSync",
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

        // Let pm2 stop the process after which we can quit the app gracefully...
        setTimeout(() => {
          app.quit();
        }, 1000);

        pm2.stop("eisensync", errback => {
          console.log("errback", errback);
        });
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
if (process.env.NODE_ENV !== "production") {
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
