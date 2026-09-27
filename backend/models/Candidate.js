const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  name: { type: String, required: true },
  chainCandidateId: { type: Number, required: true },
  txHash: { type: String, default: null },
});

candidateSchema.index({ election: 1, chainCandidateId: 1 }, { unique: true });

module.exports = mongoose.model("Candidate", candidateSchema);
