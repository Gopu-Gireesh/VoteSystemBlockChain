const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { login, walletChallenge, associateWallet } = require("../controllers/authController");

router.post("/login", login);
router.post("/wallet/challenge", protect, walletChallenge);
router.post("/wallet", protect, associateWallet);

module.exports = router;
