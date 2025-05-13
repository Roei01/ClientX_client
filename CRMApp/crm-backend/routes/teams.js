const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Team = require("../models/Team");
const User = require("../models/User");
const Task = require("../models/Task");
const SystemLog = require("../models/SystemLog");
const {
  authenticateJWT,
  authorize,
  isActiveUser,
} = require("../middlewares/auth");

// Get all teams
router.get("/", authenticateJWT, async (req, res) => {
  try {
    // Different queries based on user role
    let query = {};

    // Team leaders can only see their teams
    if (req.user.role === "teamLeader") {
      query = { teamLeader: req.user._id };
    }
    // Employees can only see their assigned team
    else if (req.user.role === "employee") {
      const user = await User.findById(req.user._id);
      if (!user || !user.team) {
        return res.json({ success: true, teams: [] });
      }
      query = { _id: user.team };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sort options
    const sortField = req.query.sortField || "name";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;

    const teams = await Team.find(query)
      .populate("teamLeader", "username firstName lastName")
      .populate("members", "username firstName lastName")
      .populate("createdBy", "username firstName lastName")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalTeams = await Team.countDocuments(query);

    res.json({
      success: true,
      teams,
      pagination: {
        total: totalTeams,
        page,
        limit,
        pages: Math.ceil(totalTeams / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get team by ID
router.get("/:id", authenticateJWT, async (req, res) => {
  try {
    const teamId = req.params.id;

    const team = await Team.findById(teamId)
      .populate("teamLeader", "username firstName lastName email phone avatar")
      .populate(
        "members",
        "username firstName lastName email phone avatar role"
      )
      .populate("createdBy", "username firstName lastName");

    if (!team) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    // Access control
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isTeamLeader =
      req.user._id.toString() === team.teamLeader?._id.toString();
    const isTeamMember = team.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isAdmin && !isManager && !isTeamLeader && !isTeamMember) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view this team" });
    }

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new team
router.post(
  "/",
  authenticateJWT,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const { name, description, teamLeader, members = [] } = req.body;

      // Validate team leader exists and is not already leading another team
      if (teamLeader) {
        const leaderUser = await User.findById(teamLeader);

        if (!leaderUser) {
          return res
            .status(400)
            .json({ success: false, message: "Team leader user not found" });
        }

        if (leaderUser.role !== "teamLeader") {
          // Update user to team leader role
          await User.findByIdAndUpdate(teamLeader, { role: "teamLeader" });
        }
      }

      // Create new team
      const newTeam = new Team({
        name,
        description,
        teamLeader,
        members: members.length > 0 ? [...new Set(members)] : [],
        createdBy: req.user._id,
      });

      await newTeam.save();

      // Update team leader's managedTeams array
      if (teamLeader) {
        await User.findByIdAndUpdate(teamLeader, {
          $addToSet: { managedTeams: newTeam._id },
          team: newTeam._id,
        });
      }

      // Update team members' team field
      if (members.length > 0) {
        await User.updateMany({ _id: { $in: members } }, { team: newTeam._id });
      }

      // Log team creation
      const systemLog = new SystemLog({
        action: "create",
        entityType: "Team",
        entityId: newTeam._id,
        newState: {
          name: newTeam.name,
          teamLeader: newTeam.teamLeader,
          membersCount: newTeam.members.length,
        },
        user: req.user._id,
        details: `Team ${newTeam.name} created by ${req.user.username}`,
      });

      await systemLog.save();

      res.status(201).json({ success: true, team: newTeam });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Update team
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const teamId = req.params.id;

    // Get current team for comparison and access control
    const currentTeam = await Team.findById(teamId);
    if (!currentTeam) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    // Access control
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isTeamLeader =
      req.user._id.toString() === currentTeam.teamLeader?.toString();

    if (!isAdmin && !isManager && !isTeamLeader) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this team",
      });
    }

    const { name, description, teamLeader, members } = req.body;
    const updates = {};

    // Team leaders can only update description and members (not the leader or name)
    if (isTeamLeader && !isAdmin && !isManager) {
      if (description !== undefined) {
        updates.description = description;
      }

      if (members !== undefined) {
        updates.members = [...new Set(members)];
      }
    } else {
      // Admins and managers can update everything
      if (name !== undefined) {
        updates.name = name;
      }

      if (description !== undefined) {
        updates.description = description;
      }

      if (teamLeader !== undefined) {
        updates.teamLeader = teamLeader;
      }

      if (members !== undefined) {
        updates.members = [...new Set(members)];
      }
    }

    // If no updates provided
    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid updates provided" });
    }

    // Update updatedAt timestamp
    updates.updatedAt = Date.now();

    // Update the team
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: updates },
      { new: true }
    )
      .populate("teamLeader", "username firstName lastName")
      .populate("members", "username firstName lastName");

    // Handle team leader change
    if (
      updates.teamLeader &&
      updates.teamLeader !== currentTeam.teamLeader?.toString()
    ) {
      // Remove team from previous leader's managedTeams
      if (currentTeam.teamLeader) {
        await User.findByIdAndUpdate(currentTeam.teamLeader, {
          $pull: { managedTeams: teamId },
        });
      }

      // Add team to new leader's managedTeams
      await User.findByIdAndUpdate(updates.teamLeader, {
        $addToSet: { managedTeams: teamId },
        team: teamId,
        role: "teamLeader",
      });
    }

    // Handle members change
    if (updates.members) {
      // Get current and new member IDs as strings
      const currentMemberIds = currentTeam.members.map((id) => id.toString());
      const newMemberIds = updates.members.map((id) => id.toString());

      // Find members to add and remove
      const membersToAdd = newMemberIds.filter(
        (id) => !currentMemberIds.includes(id)
      );
      const membersToRemove = currentMemberIds.filter(
        (id) => !newMemberIds.includes(id)
      );

      // Update members to add
      if (membersToAdd.length > 0) {
        await User.updateMany({ _id: { $in: membersToAdd } }, { team: teamId });
      }

      // Update members to remove
      if (membersToRemove.length > 0) {
        await User.updateMany(
          { _id: { $in: membersToRemove } },
          { $unset: { team: "" } }
        );
      }
    }

    // Log the update
    const systemLog = new SystemLog({
      action: "update",
      entityType: "Team",
      entityId: teamId,
      previousState: {
        name: currentTeam.name,
        teamLeader: currentTeam.teamLeader,
        membersCount: currentTeam.members.length,
      },
      newState: {
        name: updatedTeam.name,
        teamLeader: updatedTeam.teamLeader,
        membersCount: updatedTeam.members.length,
      },
      user: req.user._id,
      details: `Team ${currentTeam.name} updated by ${req.user.username}`,
    });

    await systemLog.save();

    res.json({ success: true, team: updatedTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete team
router.delete(
  "/:id",
  authenticateJWT,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const teamId = req.params.id;

      // Get team for logging
      const team = await Team.findById(teamId);
      if (!team) {
        return res
          .status(404)
          .json({ success: false, message: "Team not found" });
      }

      // Check if team has tasks assigned
      const tasksCount = await Task.countDocuments({ team: teamId });
      if (tasksCount > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete team with assigned tasks. Reassign or delete tasks first.",
        });
      }

      // Log the action before deletion
      const systemLog = new SystemLog({
        action: "delete",
        entityType: "Team",
        entityId: teamId,
        previousState: {
          name: team.name,
          teamLeader: team.teamLeader,
          membersCount: team.members.length,
        },
        user: req.user._id,
        details: `Team ${team.name} deleted by ${req.user.username}`,
      });

      await systemLog.save();

      // Remove team from team leader's managedTeams
      if (team.teamLeader) {
        await User.findByIdAndUpdate(team.teamLeader, {
          $pull: { managedTeams: teamId },
        });
      }

      // Remove team reference from all members
      await User.updateMany({ team: teamId }, { $unset: { team: "" } });

      // Delete the team
      await Team.findByIdAndDelete(teamId);

      res.json({ success: true, message: "Team deleted successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get team performance stats
router.get("/:id/performance", authenticateJWT, async (req, res) => {
  try {
    const teamId = req.params.id;

    // Get team and check if exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    // Access control
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isTeamLeader =
      req.user._id.toString() === team.teamLeader?.toString();

    if (!isAdmin && !isManager && !isTeamLeader) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view team performance",
      });
    }

    // Get team members
    const memberIds = [...team.members];
    if (team.teamLeader) {
      memberIds.push(team.teamLeader);
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
    const taskStats = await Task.aggregate([
      {
        $match: {
          $or: [
            {
              assignedTo: {
                $in: memberIds.map((id) => mongoose.Types.ObjectId(id)),
              },
            },
            { team: mongoose.Types.ObjectId(teamId) },
          ],
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

    // Get task stats by member
    const taskStatsByMember = await Task.aggregate([
      {
        $match: {
          assignedTo: {
            $in: memberIds.map((id) => mongoose.Types.ObjectId(id)),
          },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          in_progress: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          _id: 1,
          userId: "$_id",
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          completed: 1,
          pending: 1,
          in_progress: 1,
          total: 1,
          completionRate: {
            $multiply: [
              {
                $divide: [
                  "$completed",
                  { $cond: [{ $eq: ["$total", 0] }, 1, "$total"] },
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $sort: { completionRate: -1 },
      },
    ]);

    // Get client stats
    const Client = require("../models/Client");

    const clientsAssigned = await Client.countDocuments({
      assignedTo: { $in: memberIds },
    });

    const clientsCreated = await Client.countDocuments({
      createdBy: { $in: memberIds },
      createdAt: { $gte: startDate, $lte: endDate },
    });

    res.json({
      success: true,
      performance: {
        tasks: formattedTaskStats,
        memberPerformance: taskStatsByMember,
        clients: {
          assigned: clientsAssigned,
          created: clientsCreated,
        },
        timeRange: {
          startDate,
          endDate,
        },
        membersCount: memberIds.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
