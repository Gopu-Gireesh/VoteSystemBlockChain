require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = [
    { username: "admin", password: "admin123", role: "Admin" },
    { username: "voter1", password: "voter123", role: "Voter" },
    { username: "voter2", password: "voter123", role: "Voter" },
    { username: "voter3", password: "voter123", role: "Voter" },
    { username: "validator1", password: "validator123", role: "Validator" },
    { username: "validator2", password: "validator123", role: "Validator" },
    { username: "validator3", password: "validator123", role: "Validator" },
  ];

  for (const entry of users) {
    const existing = await User.findOne({ username: entry.username });
    if (existing) {
      console.log(`Skip existing user: ${entry.username}`);
      continue;
    }
    await User.create({
      username: entry.username,
      password: await bcrypt.hash(entry.password, 10),
      role: entry.role,
    });
    console.log(`Created ${entry.role}: ${entry.username}`);
  }

  console.log("Seed complete");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
