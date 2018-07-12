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

// ...
// var express = require("express");
// var app = express();
// var server = require("http").Server(app);
// var io = require("socket.io")(server, {
//   origins: "localhost: http://localhost:* http://www.localhost:*"
// });

// io.on("connection", client => {
//   client.on("sync-notification", data => {
//     client.broadcast.emit("sync-notification", data);
//   });
// });

// server.listen(3002, "", function() {
//   console.log("Server up and running...");
// });
