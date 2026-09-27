require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const voterRoutes = require("./routes/voterRoutes");
const validatorRoutes = require("./routes/validatorRoutes");

connectDB();
const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/validator", validatorRoutes);

app.get("/", (req, res) => {
  res.send("Vote System Backend is running");
});

app.use((err, req, res, _next) => {
  console.error("Global Error Handler:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
