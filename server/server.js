const express = require("express");
const bodyParser = require("body-parser");
const watcher = require("./helpers/watcher");
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
app.use("/watch-nodes", require("./routes/watch-node"));
app.use("/syncer", require("./routes/syncer"));
app.use("/sites", require("./routes/site"));
app.use("/nodes/parents", require("./routes/parent-node"));
app.use("/nodes", require("./routes/node"));

watcher.watchAll();

app.listen(PORT, () => {
  console.log("server running on " + PORT);
});
