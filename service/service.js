const express = require("express");
const bodyParser = require("body-parser");
const socket = require("socket.io");
const app = express();

const server = app.listen(3002, () => {
  console.log("Server started at 3002");
});

let io = socket(server);

io.on("connection", client => {
  client.on("notification", data => {
    client.broadcast.emit("notification", data);
  });
});
