const electron = require("electron");
const url = require("url");
const path = require("path");
const server = require("./server/server");
const { app, BrowserWindow, Menu, Tray, ipcMain } = electron;

// Set environment
process.env.NODE_ENV = "dev";

let mainWindow, tray;

let forceQuit = false;

// Listen for app to be ready
app.on("ready", () => {
  // Create main window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 650,
    title: "Eisen Syncer - Syncing files made simple"
  });

  // Load system tray
  tray = new Tray(path.join(__dirname, "/src/assets/icons/linux/icon.png"));

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
const mainMenuTemplate = [
  {
    label: "File",
    submenu: [
      {
        label: "Add item",
        click() {
          alert("123");
        }
      },
      {
        label: "Quit " + app.getName(),
        accelerator: process.platform == "darwin" ? "Command+Q" : "Ctrl+Q",
        click() {
          app.quit();
        }
      }
    ]
  }
];

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
