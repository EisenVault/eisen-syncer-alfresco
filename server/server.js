const express = require("express");
const app = express();
const PORT = 7113;

// Pull in the routes
app.use("/", require("./routes/account"));

app.listen(PORT, () => {
  console.log("server running on " + PORT);
});
