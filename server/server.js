const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = 7113;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Pull in the routes
app.use("/accounts", require("./routes/account"));
app.use("/watcher", require("./routes/watcher"));

app.listen(PORT, () => {
  console.log("server running on " + PORT);
});
