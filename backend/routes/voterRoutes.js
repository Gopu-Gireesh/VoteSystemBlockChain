const express = require("express");
const router = express.Router();
const { protect, isVoter } = require("../middleware/auth");
const {
  listVoterElections,
  getVoterElection,
  castVote,
  prepareVote,
} = require("../controllers/electionController");

router.use(protect, isVoter);
router.get("/elections", listVoterElections);
router.get("/elections/:id", getVoterElection);
router.post("/elections/:id/vote", castVote);
router.post("/elections/:id/vote/prepare", prepareVote);

module.exports = router;
