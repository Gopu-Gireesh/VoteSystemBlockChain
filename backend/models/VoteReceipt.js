const mongoose = require("mongoose");

const voteReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  txHash: { type: String, required: true },
  votedAt: { type: Date, default: Date.now },
});

voteReceiptSchema.index({ user: 1, election: 1 }, { unique: true });

module.exports = mongoose.model("VoteReceipt", voteReceiptSchema);
