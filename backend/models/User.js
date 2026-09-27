const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Admin", "Voter", "Validator"], required: true },
  walletAddress: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  walletNonce: { type: String, default: null },
});

module.exports = mongoose.model("User", userSchema);
