const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Rohan@54321",
  database: "hospital_requests"
});

module.exports.db = db;
const requestRoutes = require("./routes/requestsRoute")(io, db);
// Use routes
app.get("/", (req, res) => {
    res.send("Hospital Request Backend Running ");
});
app.use("/", requestRoutes);

server.listen(3000, () => {
  console.log("Server running on port 3000");
});