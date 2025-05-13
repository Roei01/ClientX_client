const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const SystemLog = require("../models/SystemLog");
const {
  authenticateJWT,
  authorize,
  isActiveUser,
  generateToken,
  generateRefreshToken,
} = require("../middlewares/auth");

// User registration (admin only)
router.post(
  "/register",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, role, team } =
        req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username or email already exists",
        });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create the user
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || "employee",
        team,
        createdBy: req.user._id,
      });

      // If user is a team leader, set managedTeams array
      if (role === "teamLeader" && team) {
        newUser.managedTeams = [team];

        // Update team with new leader
        const Team = require("../models/Team");
        await Team.findByIdAndUpdate(team, {
          teamLeader: newUser._id,
          $addToSet: { members: newUser._id },
        });
      } else if (team) {
        // Update team with new member
        const Team = require("../models/Team");
        await Team.findByIdAndUpdate(team, {
          $addToSet: { members: newUser._id },
        });
      }

      await newUser.save();

      // Log user creation
      const systemLog = new SystemLog({
        action: "create",
        entityType: "User",
        entityId: newUser._id,
        newState: {
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },
        user: req.user._id,
        details: `User ${newUser.username} created by ${req.user.username}`,
      });

      await systemLog.save();

      // Return user without password
      const userToReturn = newUser.toObject();
      delete userToReturn.password;

      res.status(201).json({
        success: true,
        user: userToReturn,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Public signup for new users (creates an employee account)
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validate inputs
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: username, email, password, firstName, lastName",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user (always as employee role)
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: "employee",
      isActive: true,
      createdAt: Date.now(),
    });

    await newUser.save();

    // Log user creation
    const systemLog = new SystemLog({
      action: "create",
      entityType: "User",
      entityId: newUser._id,
      newState: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
      details: `User ${newUser.username} self-registered via public signup`,
    });

    await systemLog.save();

    // Return success message without sending back the user data for security
    res.status(201).json({
      success: true,
      message: "User registered successfully. You can now log in.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// User login
router.post("/login", async (req, res) => {
  try {
    console.log("Login attempt:", req.body.username);

    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      console.log("Login failed: Missing credentials");
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      console.log("Login failed: User not found");
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log("Login failed: Inactive user");
      return res.status(403).json({
        success: false,
        message:
          "Your account has been deactivated. Please contact administrator.",
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Login failed: Invalid password");
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Update last login time
    user.lastActive = Date.now();
    await user.save();

    // Generate tokens
    const token = generateToken(user);
    console.log("Generated token for user", user._id);

    // Log successful login
    const systemLog = new SystemLog({
      action: "login",
      entityType: "User",
      entityId: user._id,
      user: user._id,
      details: `User ${user.username} logged in`,
    });

    await systemLog.save();

    // Return user data and tokens (without password)
    const userToReturn = user.toObject();
    delete userToReturn.password;

    console.log("Sending token to client for user:", user._id);

    res.json({
      success: true,
      token,
      user: userToReturn,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Refresh token
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token is required" });
    }

    // Verify refresh token
    const jwt = require("jsonwebtoken");
    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || "default_jwt_secret"
    );

    // Check if it's a refresh token
    if (!payload || !payload.id || payload.type !== "refresh") {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }

    // Find user
    const user = await User.findById(payload.id);
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }

    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update user's last active timestamp
    user.lastActive = Date.now();
    await user.save();

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    res.status(500).json({ success: false, message: err.message });
  }
});

// Logout
router.post("/logout", authenticateJWT, async (req, res) => {
  try {
    // For client-side logout, the client should remove the token
    // This server-side endpoint logs the event and returns success

    // Use mock user ID if in mock mode
    const userId = req.user._id || "mock-user-id";
    const username = req.user.username || "mockuser";

    // Log the logout
    const systemLog = new SystemLog({
      action: "logout",
      entityType: "User",
      entityId: userId,
      user: userId,
      details: `User ${username} logged out`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await systemLog.save();

    // In a real system with refresh tokens, you might revoke or blacklist the token here

    res.json({
      success: true,
      message: "Logged out successfully",
      clearAuth: true, // Signal to client to clear auth tokens
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Change password
router.post(
  "/change-password",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      // Find user
      const user = await User.findById(userId);

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect" });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password
      user.password = hashedPassword;
      user.updatedAt = Date.now();
      await user.save();

      // Log password change
      const systemLog = new SystemLog({
        action: "update",
        entityType: "User",
        entityId: user._id,
        user: user._id,
        details: `User ${user.username} changed their password`,
        ipAddress: req.ip,
      });

      await systemLog.save();

      res.json({ success: true, message: "Password changed successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Reset user password (admin only)
router.post(
  "/reset-password/:id",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const { newPassword } = req.body;
      const userId = req.params.id;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password
      user.password = hashedPassword;
      user.updatedAt = Date.now();
      await user.save();

      // Log password reset
      const systemLog = new SystemLog({
        action: "update",
        entityType: "User",
        entityId: userId,
        user: req.user._id,
        details: `Password reset for user ${user.username} by ${req.user.username}`,
        ipAddress: req.ip,
      });

      await systemLog.save();

      res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get current user profile
router.get("/profile", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user and exclude password
    const user = await User.findById(userId)
      .select("-password")
      .populate("team", "name")
      .populate("managedTeams", "name");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user profile (self)
router.put("/profile", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      firstName,
      lastName,
      phone,
      avatar,
      preferredLanguage,
      notificationSettings,
    } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update allowed fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (preferredLanguage !== undefined)
      user.preferredLanguage = preferredLanguage;
    if (notificationSettings !== undefined)
      user.notificationSettings = notificationSettings;

    user.updatedAt = Date.now();
    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId)
      .select("-password")
      .populate("team", "name")
      .populate("managedTeams", "name");

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify token route
router.get("/verify", authenticateJWT, async (req, res) => {
  try {
    console.log("Token verification for user:", req.user._id);
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      userId: req.user._id,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

module.exports = router;
