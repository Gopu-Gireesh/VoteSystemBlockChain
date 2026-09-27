const jwt = require("jsonwebtoken");

exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized: No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token: " + error.message });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ message: "Access denied: Admin only" });
  }
  next();
};

exports.isVoter = (req, res, next) => {
  if (req.user.role !== "Voter") {
    return res.status(403).json({ message: "Access denied: Voter only" });
  }
  next();
};

exports.isValidator = (req, res, next) => {
  if (req.user.role !== "Validator") {
    return res.status(403).json({ message: "Access denied: Validator only" });
  }
  next();
};
