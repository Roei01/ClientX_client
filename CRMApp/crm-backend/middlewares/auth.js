const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Enable mock mode during development
const MOCK_MODE =
  process.env.MOCK_MODE === "true" || process.env.NODE_ENV === "development";

// Middleware to authenticate requests with JWT
const authenticateJWT = (req, res, next) => {
  console.log("Auth middleware called");
  console.log("Authorization header:", req.headers.authorization);

  // Check for mock mode or bypass authentication during development
  if (MOCK_MODE && !req.headers.authorization) {
    console.log("Using mock authentication");
    req.user = {
      _id: "mock-user-id",
      username: "mockuser",
      role: "admin",
      isActive: true,
      firstName: "Mock",
      lastName: "User",
      lastActive: new Date(),
    };
    return next();
  }

  // Regular JWT authentication
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      console.error("JWT auth error:", err);
      return next(err);
    }

    if (!user) {
      console.log("JWT auth failed - no user found");
      console.log("Auth info:", info);
    } else {
      console.log("JWT auth successful for user:", user._id);
    }

    if (!user && MOCK_MODE) {
      // Fallback to mock user if auth fails but we're in mock mode
      console.log("Using mock user as fallback");
      req.user = {
        _id: "mock-user-id",
        username: "mockuser",
        role: "admin",
        isActive: true,
        firstName: "Mock",
        lastName: "User",
        lastActive: new Date(),
      };
      return next();
    }

    if (!user) {
      console.log("Returning 401 Unauthorized");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid token",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

// Middleware to check user role
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // User is already authenticated at this point
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      if (MOCK_MODE) {
        // In mock mode, override permissions
        console.log("Mock mode: bypassing authorization check");
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Forbidden - insufficient permissions",
      });
    }

    next();
  };
};

// Middleware to check if user is active
const isActiveUser = async (req, res, next) => {
  try {
    // In mock mode, skip the check
    if (MOCK_MODE && req.user._id === "mock-user-id") {
      return next();
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been deactivated. Please contact administrator.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Middleware to check if user's session is valid
const validateSession = (req, res, next) => {
  const now = new Date();
  const lastActive = new Date(req.user.lastActive);
  const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT || "60");
  const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));

  if (diffMinutes > sessionTimeout) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again.",
    });
  }

  next();
};

// Check if user can manage a specific client
const canManageClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const user = req.user;

    // Admins and managers can manage all clients
    if (user.role === "admin" || user.role === "manager") {
      return next();
    }

    // For teamLeaders and employees, check if client is assigned to them
    const Client = require("../models/Client");
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (
      client.assignedTo &&
      client.assignedTo.toString() === user._id.toString()
    ) {
      return next();
    }

    // If team leader, check if client is assigned to any team member
    if (
      user.role === "teamLeader" &&
      user.managedTeams &&
      user.managedTeams.length > 0
    ) {
      const Team = require("../models/Team");
      const teams = await Team.find({ _id: { $in: user.managedTeams } });

      for (const team of teams) {
        if (
          team.members.some(
            (memberId) =>
              client.assignedTo &&
              client.assignedTo.toString() === memberId.toString()
          )
        ) {
          return next();
        }
      }
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to manage this client",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || "default_jwt_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

// Generate refresh token
const generateRefreshToken = (user) => {
  const payload = {
    id: user._id,
    type: "refresh",
  };

  return jwt.sign(payload, process.env.JWT_SECRET || "default_jwt_secret", {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

module.exports = {
  authenticateJWT,
  authorize,
  isActiveUser,
  validateSession,
  canManageClient,
  generateToken,
  generateRefreshToken,
};
