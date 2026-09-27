const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  chainElectionId: { type: Number, required: true, unique: true },
  closed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createTxHash: { type: String, default: null },
  closeTxHash: { type: String, default: null },
});

module.exports = mongoose.model("Election", electionSchema);
