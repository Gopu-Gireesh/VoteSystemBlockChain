const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  createElection,
  addCandidate,
  closeElection,
  listElections,
  getElection,
  setEligibility,
} = require("../controllers/electionController");

router.use(protect, isAdmin);
router.get("/elections", listElections);
router.post("/elections", createElection);
router.get("/elections/:id", getElection);
router.post("/elections/:id/candidates", addCandidate);
router.post("/elections/:id/eligibility", setEligibility);
router.post("/elections/:id/close", closeElection);

module.exports = router;
