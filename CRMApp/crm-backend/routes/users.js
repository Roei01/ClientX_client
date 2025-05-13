const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Team = require("../models/Team");
const {
  authenticateJWT,
  authorize,
  isActiveUser,
  validateSession,
} = require("../middlewares/auth");
const SystemLog = require("../models/SystemLog");

// Get all users (admin and manager only)
router.get(
  "/",
  authenticateJWT,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const query = {};

      // Filter by role if specified
      if (req.query.role) {
        query.role = req.query.role;
      }

      // Filter by active status if specified
      if (req.query.isActive !== undefined) {
        query.isActive = req.query.isActive === "true";
      }

      // Filter by team if specified
      if (req.query.team) {
        query.team = req.query.team;
      }

      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Sort options
      const sortField = req.query.sortField || "createdAt";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
      const sortOptions = {};
      sortOptions[sortField] = sortOrder;

      const users = await User.find(query)
        .select("-password")
        .populate("team", "name")
        .populate("managedTeams", "name")
        .populate("createdBy", "username firstName lastName")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const totalUsers = await User.countDocuments(query);

      res.json({
        success: true,
        users,
        pagination: {
          total: totalUsers,
          page,
          limit,
          pages: Math.ceil(totalUsers / limit),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get team members for team leader
router.get(
  "/my-team",
  authenticateJWT,
  authorize("teamLeader", "manager", "admin"),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      let teams = [];

      if (user.role === "teamLeader") {
        teams = await Team.find({ teamLeader: userId });
      } else if (user.role === "manager" || user.role === "admin") {
        teams = await Team.find({});
      }

      if (teams.length === 0) {
        return res.json({ success: true, teamMembers: [] });
      }

      const teamIds = teams.map((team) => team._id);

      const teamMembers = await User.find({
        $or: [
          { team: { $in: teamIds } },
          { _id: { $in: teams.map((team) => team.teamLeader) } },
        ],
      })
        .select("-password")
        .populate("team", "name");

      res.json({ success: true, teamMembers });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get specific user
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("team", "name")
      .populate("managedTeams", "name")
      .populate("createdBy", "username firstName lastName");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check permissions - only admin, manager, the user themselves, or their team leader can view details
    if (
      req.user.role === "admin" ||
      req.user.role === "manager" ||
      req.user._id.toString() === req.params.id
    ) {
      return res.json({ success: true, user });
    }

    // If team leader, check if viewing team member
    if (req.user.role === "teamLeader") {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((member) => member.toString())
      );

      if (teamMemberIds.includes(req.params.id)) {
        return res.json({ success: true, user });
      }
    }

    return res
      .status(403)
      .json({ success: false, message: "Unauthorized to view this user" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new user (admin only)
router.post("/", authenticateJWT, authorize("admin"), async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role,
      team,
      phone,
      preferredLanguage,
      notificationSettings,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      team,
      phone,
      preferredLanguage,
      notificationSettings,
      createdBy: req.user._id,
    });

    // If user is a teamLeader, add team to managedTeams
    if (role === "teamLeader" && team) {
      newUser.managedTeams = [team];
    }

    await newUser.save();

    // If adding to a team, update the team's members
    if (team) {
      await Team.findByIdAndUpdate(team, {
        $addToSet: { members: newUser._id },
      });
    }

    // Log the action
    const systemLog = new SystemLog({
      action: "create",
      entityType: "User",
      entityId: newUser._id,
      newState: {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        team: newUser.team,
      },
      user: req.user._id,
      details: `User ${newUser.username} created by ${req.user.username}`,
    });

    await systemLog.save();

    // Return user without password
    const userToReturn = newUser.toObject();
    delete userToReturn.password;

    res.status(201).json({ success: true, user: userToReturn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Get current user state for logging
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isSelfUpdate = req.user._id.toString() === userId;
    const isTeamLeader = req.user.role === "teamLeader";

    let isTeamMember = false;
    if (isTeamLeader) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((member) => member.toString())
      );
      isTeamMember = teamMemberIds.includes(userId);
    }

    // Only allow update if authorized
    if (
      !isAdmin &&
      !isManager &&
      !isSelfUpdate &&
      !(isTeamLeader && isTeamMember)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this user",
      });
    }

    // Determine what fields can be updated based on role
    const updates = {};

    // Fields anyone can update on themselves
    if (isSelfUpdate) {
      const allowedSelfUpdates = [
        "firstName",
        "lastName",
        "phone",
        "avatar",
        "preferredLanguage",
        "notificationSettings",
        "dashboardSettings",
      ];

      allowedSelfUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Password update requires old password verification
      if (req.body.newPassword && req.body.currentPassword) {
        const isMatch = await bcrypt.compare(
          req.body.currentPassword,
          currentUser.password
        );
        if (!isMatch) {
          return res
            .status(400)
            .json({ success: false, message: "Current password is incorrect" });
        }

        updates.password = await bcrypt.hash(req.body.newPassword, 10);
      }
    }

    // Additional fields team leaders can update on their team members
    if (isTeamLeader && isTeamMember) {
      const allowedTeamLeaderUpdates = ["isActive"];

      allowedTeamLeaderUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
    }

    // Admins and managers can update almost everything
    if (isAdmin || isManager) {
      const allowedAdminUpdates = [
        "username",
        "email",
        "firstName",
        "lastName",
        "role",
        "team",
        "phone",
        "isActive",
        "preferredLanguage",
        "notificationSettings",
      ];

      allowedAdminUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Admin can reset password without old password
      if (req.body.newPassword) {
        updates.password = await bcrypt.hash(req.body.newPassword, 10);
      }

      // If changing role to/from teamLeader, handle managedTeams
      if (req.body.role === "teamLeader" && currentUser.role !== "teamLeader") {
        updates.managedTeams = req.body.team ? [req.body.team] : [];
      } else if (
        req.body.role !== "teamLeader" &&
        currentUser.role === "teamLeader"
      ) {
        updates.managedTeams = [];
      }
    }

    // If no updates provided
    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid updates provided" });
    }

    // Add updatedAt timestamp
    updates.updatedAt = Date.now();

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password");

    // If team changed, update team members arrays
    if (updates.team && updates.team !== currentUser.team?.toString()) {
      // Remove from old team
      if (currentUser.team) {
        await Team.findByIdAndUpdate(currentUser.team, {
          $pull: { members: userId },
        });
      }

      // Add to new team
      await Team.findByIdAndUpdate(updates.team, {
        $addToSet: { members: userId },
      });
    }

    // Log the update
    const systemLog = new SystemLog({
      action: "update",
      entityType: "User",
      entityId: userId,
      previousState: {
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role,
        team: currentUser.team,
        isActive: currentUser.isActive,
      },
      newState: {
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        team: updatedUser.team,
        isActive: updatedUser.isActive,
      },
      user: req.user._id,
      details: `User ${currentUser.username} updated by ${req.user.username}`,
    });

    await systemLog.save();

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete user (admin only)
router.delete("/:id", authenticateJWT, authorize("admin"), async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user for logging
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Prevent deleting yourself
    if (req.user._id.toString() === userId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete your own account" });
    }

    // Log the action before deletion
    const systemLog = new SystemLog({
      action: "delete",
      entityType: "User",
      entityId: userId,
      previousState: {
        username: user.username,
        email: user.email,
        role: user.role,
        team: user.team,
      },
      user: req.user._id,
      details: `User ${user.username} deleted by ${req.user.username}`,
    });

    await systemLog.save();

    // Remove from team
    if (user.team) {
      await Team.findByIdAndUpdate(user.team, { $pull: { members: userId } });
    }

    // If user is team leader, reassign team
    if (user.role === "teamLeader") {
      await Team.updateMany(
        { teamLeader: userId },
        { $unset: { teamLeader: 1 } }
      );
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user activity
router.get("/:id/activity", authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isSelf = req.user._id.toString() === userId;
    const isTeamLeader = req.user.role === "teamLeader";

    let isTeamMember = false;
    if (isTeamLeader) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((member) => member.toString())
      );
      isTeamMember = teamMemberIds.includes(userId);
    }

    if (!isAdmin && !isManager && !isSelf && !(isTeamLeader && isTeamMember)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user activity",
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get logs
    const logs = await SystemLog.find({ user: userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const totalLogs = await SystemLog.countDocuments({ user: userId });

    res.json({
      success: true,
      logs,
      pagination: {
        total: totalLogs,
        page,
        limit,
        pages: Math.ceil(totalLogs / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user performance stats
router.get("/:id/performance", authenticateJWT, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isSelf = req.user._id.toString() === userId;
    const isTeamLeader = req.user.role === "teamLeader";

    let isTeamMember = false;
    if (isTeamLeader) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((member) => member.toString())
      );
      isTeamMember = teamMemberIds.includes(userId);
    }

    if (!isAdmin && !isManager && !isSelf && !(isTeamLeader && isTeamMember)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user performance",
      });
    }

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Default to 30 days

    if (req.query.startDate) {
      startDate.setTime(Date.parse(req.query.startDate));
    }

    if (req.query.endDate) {
      endDate.setTime(Date.parse(req.query.endDate));
    }

    // Get task stats
    const Task = require("../models/Task");

    const taskStats = await Task.aggregate([
      {
        $match: {
          assignedTo: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format task stats
    const formattedTaskStats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    taskStats.forEach((stat) => {
      formattedTaskStats[stat._id] = stat.count;
    });

    // Get completed tasks on time vs late
    const completedTasks = await Task.find({
      assignedTo: userId,
      status: "completed",
      completedAt: { $exists: true, $ne: null },
      dueDate: { $exists: true, $ne: null },
    });

    let onTimeCount = 0;
    let lateCount = 0;

    completedTasks.forEach((task) => {
      if (task.completedAt <= task.dueDate) {
        onTimeCount++;
      } else {
        lateCount++;
      }
    });

    // Get client interactions
    const Client = require("../models/Client");

    const clientsAssigned = await Client.countDocuments({
      assignedTo: userId,
    });

    const clientsCreated = await Client.countDocuments({
      createdBy: userId,
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Get last login time
    const user = await User.findById(userId);

    res.json({
      success: true,
      performance: {
        tasks: formattedTaskStats,
        taskCompletion: {
          onTime: onTimeCount,
          late: lateCount,
          completionRate:
            completedTasks.length > 0
              ? ((onTimeCount / completedTasks.length) * 100).toFixed(2)
              : 0,
        },
        clients: {
          assigned: clientsAssigned,
          created: clientsCreated,
        },
        lastActive: user.lastActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
