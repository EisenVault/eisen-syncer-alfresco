const express = require("express");
const bodyParser = require("body-parser");
const watcher = require("./helpers/watcher");
const accountModel = require("./models/account");
const cors = require("cors");
const app = express();
const PORT = 7113;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Pull in the routes
app.use("/logs/events", require("./routes/logs/event"));
app.use("/logs/errors", require("./routes/logs/error"));
app.use("/settings", require("./routes/setting"));
app.use("/accounts", require("./routes/account"));
app.use("/syncer", require("./routes/syncer"));
app.use("/sites", require("./routes/site"));
app.use("/nodes/parents", require("./routes/parent-node"));
app.use("/nodes", require("./routes/node"));

(async () => {
  let accounts = await accountModel.getAll();

  // For every account, set the sync progress to compeleted
  for (const account of accounts) {
    await accountModel.syncComplete(account.id);
  }
})();

// Start watching all the sync_paths
watcher.watchAll();

app.listen(PORT, () => {
  console.log("server running on " + PORT);
});
