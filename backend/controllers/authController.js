const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { ethers } = require("ethers");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
      username: user.username,
      walletAddress: user.walletAddress || null,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.walletChallenge = async (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `VoteSystem wallet association\nUser: ${req.user.userId}\nNonce: ${nonce}`;
  await User.findByIdAndUpdate(req.user.userId, { walletNonce: nonce });
  res.json({ message });
};

exports.associateWallet = async (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!ethers.isAddress(address) || !signature) {
      return res.status(400).json({ message: "Valid address and signature are required" });
    }
    const user = await User.findById(req.user.userId);
    if (!user || !user.walletNonce) return res.status(400).json({ message: "Request a wallet challenge first" });
    const message = `VoteSystem wallet association\nUser: ${user._id}\nNonce: ${user.walletNonce}`;
    if (ethers.verifyMessage(message, signature).toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ message: "Wallet signature does not match address" });
    }
    user.walletAddress = address.toLowerCase();
    user.walletNonce = null;
    await user.save();
    res.json({ walletAddress: user.walletAddress });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Wallet is already associated" });
    res.status(400).json({ message: error.message || "Wallet association failed" });
  }
};
