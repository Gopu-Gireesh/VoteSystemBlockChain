const express = require("express");
const router = express.Router();
const { protect, isValidator } = require("../middleware/auth");
const {
  listValidatorElections,
  prepareApproval,
  prepareRejection,
  confirmValidatorAction,
} = require("../controllers/electionController");

router.use(protect, isValidator);
router.get("/elections", listValidatorElections);
router.post("/elections/:id/approve/prepare", prepareApproval);
router.post("/elections/:id/reject/prepare", prepareRejection);
router.post("/elections/:id/confirm", confirmValidatorAction);

module.exports = router;