const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const app = express();

app.use(cors());

const server = app.listen(3002, () => {
  console.log("Server started at 3002");
});

let io = socket(server);

io.on("connection", client => {
  client.on("sync-notification", data => {
    client.broadcast.emit("sync-notification", data);
  });
});
