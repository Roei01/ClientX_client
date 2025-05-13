const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Task = require("../models/Task");
const User = require("../models/User");
const Team = require("../models/Team");
const Client = require("../models/Client");
const Notification = require("../models/Notification");
const SystemLog = require("../models/SystemLog");
const {
  authenticateJWT,
  authorize,
  isActiveUser,
} = require("../middlewares/auth");

// Get all tasks with filtering
router.get("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    // Build query based on user role and filters
    const query = {};

    // Role-based access control for tasks
    if (req.user.role === "employee") {
      // Employees can only see tasks assigned to them
      query.assignedTo = req.user._id;
    } else if (req.user.role === "teamLeader") {
      // Team leaders can see tasks assigned to their team members or themselves
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) => team.members);
      teamMemberIds.push(req.user._id); // Include the team leader's own tasks

      // Get tasks for team members or teams led by the team leader
      query.$or = [
        { assignedTo: { $in: teamMemberIds } },
        { team: { $in: teams.map((team) => team._id) } },
      ];
    }
    // Admins and managers can see all tasks, so no additional filter

    // Apply filters from request query
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    if (req.query.assignedTo) {
      // Check if user has permission to see tasks for this assignee
      if (
        req.user.role === "employee" &&
        req.query.assignedTo !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view tasks assigned to others",
        });
      }

      if (req.user.role === "teamLeader") {
        const teams = await Team.find({ teamLeader: req.user._id });
        const teamMemberIds = teams.flatMap((team) =>
          team.members.map((id) => id.toString())
        );

        if (
          !teamMemberIds.includes(req.query.assignedTo) &&
          req.query.assignedTo !== req.user._id.toString()
        ) {
          return res.status(403).json({
            success: false,
            message: "You are not authorized to view tasks for this user",
          });
        }
      }

      // If authorized, apply the filter
      query.assignedTo = mongoose.Types.ObjectId(req.query.assignedTo);
    }

    if (req.query.team) {
      // Check if user has permission to see tasks for this team
      if (req.user.role === "teamLeader") {
        const teams = await Team.find({ teamLeader: req.user._id });
        const teamIds = teams.map((team) => team._id.toString());

        if (!teamIds.includes(req.query.team)) {
          return res.status(403).json({
            success: false,
            message: "You are not authorized to view tasks for this team",
          });
        }
      }

      // If authorized, apply the filter
      query.team = mongoose.Types.ObjectId(req.query.team);
    }

    if (req.query.client) {
      query.client = mongoose.Types.ObjectId(req.query.client);
    }

    if (req.query.dueDate) {
      const dueDate = new Date(req.query.dueDate);
      query.dueDate = { $lte: dueDate };
    }

    if (req.query.tags) {
      const tags = req.query.tags.split(",");
      query.tags = { $in: tags };
    }

    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      query.dueDate = { $gte: startDate, $lte: endDate };
    } else if (req.query.startDate) {
      const startDate = new Date(req.query.startDate);
      query.dueDate = { $gte: startDate };
    } else if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      query.dueDate = { $lte: endDate };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sort options
    const sortField = req.query.sortField || "dueDate";
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;

    // Get tasks
    const tasks = await Task.find(query)
      .populate("assignedTo", "username firstName lastName")
      .populate("assignedBy", "username firstName lastName")
      .populate("team", "name")
      .populate("client", "name email")
      .populate("createdBy", "username firstName lastName")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalTasks = await Task.countDocuments(query);

    res.json({
      success: true,
      tasks,
      pagination: {
        total: totalTasks,
        page,
        limit,
        pages: Math.ceil(totalTasks / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get a specific task
router.get("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await Task.findById(taskId)
      .populate("assignedTo", "username firstName lastName email phone avatar")
      .populate("assignedBy", "username firstName lastName")
      .populate("team", "name")
      .populate("client", "name email phone")
      .populate("createdBy", "username firstName lastName")
      .populate("comments.createdBy", "username firstName lastName avatar");

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Check authorization
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isAssignedToUser =
      task.assignedTo &&
      task.assignedTo._id.toString() === req.user._id.toString();
    const isAssignedByUser =
      task.assignedBy &&
      task.assignedBy._id.toString() === req.user._id.toString();

    let isTeamLeaderOfAssignee = false;
    if (req.user.role === "teamLeader" && task.assignedTo) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((id) => id.toString())
      );
      isTeamLeaderOfAssignee = teamMemberIds.includes(
        task.assignedTo._id.toString()
      );
    }

    if (
      !isAdmin &&
      !isManager &&
      !isAssignedToUser &&
      !isAssignedByUser &&
      !isTeamLeaderOfAssignee
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to view this task" });
    }

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a new task
router.post("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const {
      title,
      description,
      dueDate,
      assignedTo,
      team,
      client,
      priority = "medium",
      tags = [],
      recurrence,
      reminders = [],
    } = req.body;

    // Validate assignedTo user exists
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res
        .status(400)
        .json({ success: false, message: "Assigned user not found" });
    }

    // Check authorization for assigning tasks
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isSelfAssigned = assignedTo === req.user._id.toString();

    let canAssignTask = isAdmin || isManager || isSelfAssigned;

    // Team leaders can assign tasks to their team members
    if (req.user.role === "teamLeader" && !canAssignTask) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((id) => id.toString())
      );
      canAssignTask = teamMemberIds.includes(assignedTo);
    }

    if (!canAssignTask) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to assign tasks to this user",
      });
    }

    // Create the task
    const newTask = new Task({
      title,
      description,
      dueDate: new Date(dueDate),
      assignedTo,
      assignedBy: req.user._id,
      team,
      client,
      priority,
      tags,
      recurrence,
      createdBy: req.user._id,
    });

    // Add reminders if provided
    if (reminders && reminders.length > 0) {
      newTask.reminders = reminders.map((reminderTime) => ({
        time: new Date(reminderTime),
        sent: false,
      }));
    }

    await newTask.save();

    // Create notification for the assigned user
    const notification = new Notification({
      user: assignedTo,
      title: "New Task Assigned",
      content: `You have been assigned a new task: ${title}`,
      type: "task",
      relatedDocument: {
        documentType: "Task",
        documentId: newTask._id,
      },
      isActionRequired: true,
    });

    await notification.save();

    // Emit socket event for real-time notification
    const io = req.app.get("socketio");
    if (io) {
      io.to(assignedTo).emit("notification", {
        type: "task",
        message: `You have been assigned a new task: ${title}`,
        task: newTask,
      });
    }

    // Log the task creation
    const systemLog = new SystemLog({
      action: "create",
      entityType: "Task",
      entityId: newTask._id,
      newState: {
        title: newTask.title,
        assignedTo: newTask.assignedTo,
        dueDate: newTask.dueDate,
        priority: newTask.priority,
      },
      user: req.user._id,
      details: `Task ${newTask.title} created by ${req.user.username} and assigned to ${assignedUser.username}`,
    });

    await systemLog.save();

    // Create recurring tasks if specified
    if (recurrence && recurrence.isRecurring) {
      // This will be handled by a background scheduler (Agenda)
      // For now, just log that recurring tasks will be created
      console.log(
        `Recurring task created with pattern: ${recurrence.frequency}`
      );
    }

    // Return the created task
    const createdTask = await Task.findById(newTask._id)
      .populate("assignedTo", "username firstName lastName")
      .populate("assignedBy", "username firstName lastName")
      .populate("team", "name")
      .populate("client", "name email");

    res.status(201).json({ success: true, task: createdTask });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a task
router.put("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const taskId = req.params.id;

    // Get the current task for permission checking and logging
    const currentTask = await Task.findById(taskId);
    if (!currentTask) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Check authorization
    const isAdmin = req.user.role === "admin";
    const isManager = req.user.role === "manager";
    const isAssignedToUser =
      currentTask.assignedTo &&
      currentTask.assignedTo.toString() === req.user._id.toString();
    const isAssignedByUser =
      currentTask.assignedBy &&
      currentTask.assignedBy.toString() === req.user._id.toString();

    let isTeamLeaderOfAssignee = false;
    if (req.user.role === "teamLeader" && currentTask.assignedTo) {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) =>
        team.members.map((id) => id.toString())
      );
      isTeamLeaderOfAssignee = teamMemberIds.includes(
        currentTask.assignedTo.toString()
      );
    }

    const canUpdateTask =
      isAdmin ||
      isManager ||
      isAssignedToUser ||
      isAssignedByUser ||
      isTeamLeaderOfAssignee;

    if (!canUpdateTask) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this task",
      });
    }

    // Prepare updates based on role
    const updates = {};

    // All authorized users can update these fields
    const allowedUpdates = [
      "title",
      "description",
      "status",
      "priority",
      "tags",
    ];

    // Add status-specific fields
    if (req.body.status === "completed" && currentTask.status !== "completed") {
      updates.completedAt = Date.now();
    } else if (
      req.body.status !== "completed" &&
      currentTask.status === "completed"
    ) {
      updates.$unset = { completedAt: 1 };
    }

    // Apply common updates
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Admin, Manager, Task creator, and Team leader can update these additional fields
    if (isAdmin || isManager || isAssignedByUser || isTeamLeaderOfAssignee) {
      const additionalFields = [
        "dueDate",
        "team",
        "client",
        "recurrence",
        "reminders",
      ];

      additionalFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Handle assignedTo changes
      if (
        req.body.assignedTo &&
        req.body.assignedTo !== currentTask.assignedTo.toString()
      ) {
        // Validate new assignee
        const newAssignee = await User.findById(req.body.assignedTo);
        if (!newAssignee) {
          return res
            .status(400)
            .json({ success: false, message: "New assigned user not found" });
        }

        // Team leader can only reassign to their team members
        if (req.user.role === "teamLeader") {
          const teams = await Team.find({ teamLeader: req.user._id });
          const teamMemberIds = teams.flatMap((team) =>
            team.members.map((id) => id.toString())
          );

          if (!teamMemberIds.includes(req.body.assignedTo)) {
            return res.status(403).json({
              success: false,
              message:
                "Team leaders can only reassign tasks to their team members",
            });
          }
        }

        updates.assignedTo = req.body.assignedTo;

        // Create notification for the new assignee
        const notification = new Notification({
          user: req.body.assignedTo,
          title: "Task Reassigned to You",
          content: `You have been assigned the task: ${currentTask.title}`,
          type: "task",
          relatedDocument: {
            documentType: "Task",
            documentId: taskId,
          },
          isActionRequired: true,
        });

        await notification.save();

        // Emit socket event for real-time notification
        const io = req.app.get("socketio");
        if (io) {
          io.to(req.body.assignedTo).emit("notification", {
            type: "task",
            message: `You have been assigned the task: ${currentTask.title}`,
            taskId,
          });
        }
      }
    }

    // Update timestamp
    updates.updatedAt = Date.now();

    // Perform the update
    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, {
      new: true,
    })
      .populate("assignedTo", "username firstName lastName")
      .populate("assignedBy", "username firstName lastName")
      .populate("team", "name")
      .populate("client", "name email")
      .populate("comments.createdBy", "username firstName lastName avatar");

    // Log the update
    const systemLog = new SystemLog({
      action: "update",
      entityType: "Task",
      entityId: taskId,
      previousState: {
        title: currentTask.title,
        status: currentTask.status,
        assignedTo: currentTask.assignedTo,
        dueDate: currentTask.dueDate,
        priority: currentTask.priority,
      },
      newState: {
        title: updatedTask.title,
        status: updatedTask.status,
        assignedTo: updatedTask.assignedTo,
        dueDate: updatedTask.dueDate,
        priority: updatedTask.priority,
      },
      user: req.user._id,
      details: `Task ${currentTask.title} updated by ${req.user.username}`,
    });

    await systemLog.save();

    res.json({ success: true, task: updatedTask });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a task
router.delete(
  "/:id",
  authenticateJWT,
  authorize("admin", "manager"),
  async (req, res) => {
    try {
      const taskId = req.params.id;

      // Get the task for logging
      const task = await Task.findById(taskId);
      if (!task) {
        return res
          .status(404)
          .json({ success: false, message: "Task not found" });
      }

      // Log the deletion
      const systemLog = new SystemLog({
        action: "delete",
        entityType: "Task",
        entityId: taskId,
        previousState: {
          title: task.title,
          status: task.status,
          assignedTo: task.assignedTo,
          dueDate: task.dueDate,
          priority: task.priority,
        },
        user: req.user._id,
        details: `Task ${task.title} deleted by ${req.user.username}`,
      });

      await systemLog.save();

      // Delete related notifications
      await Notification.deleteMany({
        "relatedDocument.documentType": "Task",
        "relatedDocument.documentId": taskId,
      });

      // Delete the task
      await Task.findByIdAndDelete(taskId);

      res.json({ success: true, message: "Task deleted successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Add a comment to a task
router.post(
  "/:id/comments",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      const taskId = req.params.id;
      const { content } = req.body;

      if (!content) {
        return res
          .status(400)
          .json({ success: false, message: "Comment content is required" });
      }

      // Get the task
      const task = await Task.findById(taskId);
      if (!task) {
        return res
          .status(404)
          .json({ success: false, message: "Task not found" });
      }

      // Check authorization - anyone who can view the task can comment
      const isAdmin = req.user.role === "admin";
      const isManager = req.user.role === "manager";
      const isAssignedToUser =
        task.assignedTo &&
        task.assignedTo.toString() === req.user._id.toString();
      const isAssignedByUser =
        task.assignedBy &&
        task.assignedBy.toString() === req.user._id.toString();

      let isTeamLeaderOfAssignee = false;
      if (req.user.role === "teamLeader" && task.assignedTo) {
        const teams = await Team.find({ teamLeader: req.user._id });
        const teamMemberIds = teams.flatMap((team) =>
          team.members.map((id) => id.toString())
        );
        isTeamLeaderOfAssignee = teamMemberIds.includes(
          task.assignedTo.toString()
        );
      }

      if (
        !isAdmin &&
        !isManager &&
        !isAssignedToUser &&
        !isAssignedByUser &&
        !isTeamLeaderOfAssignee
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to comment on this task",
        });
      }

      // Add the comment
      const comment = {
        content,
        createdBy: req.user._id,
        createdAt: Date.now(),
      };

      task.comments.push(comment);
      await task.save();

      // Create notification for task owner and assignee (if different from commenter)
      const notifyUsers = new Set();

      if (
        task.assignedTo &&
        task.assignedTo.toString() !== req.user._id.toString()
      ) {
        notifyUsers.add(task.assignedTo.toString());
      }

      if (
        task.assignedBy &&
        task.assignedBy.toString() !== req.user._id.toString()
      ) {
        notifyUsers.add(task.assignedBy.toString());
      }

      // Create notifications and send socket events
      const io = req.app.get("socketio");

      for (const userId of notifyUsers) {
        const notification = new Notification({
          user: userId,
          title: "New Comment on Task",
          content: `${req.user.username} commented on task: ${task.title}`,
          type: "task",
          relatedDocument: {
            documentType: "Task",
            documentId: taskId,
          },
        });

        await notification.save();

        if (io) {
          io.to(userId).emit("notification", {
            type: "task_comment",
            message: `${req.user.username} commented on task: ${task.title}`,
            taskId,
          });
        }
      }

      // Return the updated task with populated comments
      const updatedTask = await Task.findById(taskId)
        .populate("assignedTo", "username firstName lastName")
        .populate("assignedBy", "username firstName lastName")
        .populate("comments.createdBy", "username firstName lastName avatar");

      res.status(201).json({ success: true, task: updatedTask });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get task statistics
router.get("/stats/summary", authenticateJWT, async (req, res) => {
  try {
    // Base query - will be modified based on user role
    let baseQuery = {};

    // For employees, only show their tasks
    if (req.user.role === "employee") {
      baseQuery.assignedTo = req.user._id;
    }
    // For team leaders, show tasks for their team members
    else if (req.user.role === "teamLeader") {
      const teams = await Team.find({ teamLeader: req.user._id });
      const teamMemberIds = teams.flatMap((team) => team.members);
      teamMemberIds.push(req.user._id); // Include team leader's own tasks

      baseQuery.$or = [
        { assignedTo: { $in: teamMemberIds } },
        { team: { $in: teams.map((team) => team._id) } },
      ];
    }

    // Get stats by status
    const statusStats = await Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Format status stats
    const formattedStatusStats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    statusStats.forEach((stat) => {
      formattedStatusStats[stat._id] = stat.count;
    });

    // Get stats by priority
    const priorityStats = await Task.aggregate([
      { $match: baseQuery },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Format priority stats
    const formattedPriorityStats = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    priorityStats.forEach((stat) => {
      formattedPriorityStats[stat._id] = stat.count;
    });

    // Get overdue tasks
    const now = new Date();
    const overdueQuery = {
      ...baseQuery,
      dueDate: { $lt: now },
      status: { $nin: ["completed", "cancelled"] },
    };

    const overdueCount = await Task.countDocuments(overdueQuery);

    // Get upcoming tasks (due in next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingQuery = {
      ...baseQuery,
      dueDate: { $gte: now, $lte: nextWeek },
      status: { $nin: ["completed", "cancelled"] },
    };

    const upcomingCount = await Task.countDocuments(upcomingQuery);

    // Get tasks completed on time vs late
    const completedTasks = await Task.find({
      ...baseQuery,
      status: "completed",
      completedAt: { $exists: true, $ne: null },
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

    // Return the stats
    res.json({
      success: true,
      statistics: {
        byStatus: formattedStatusStats,
        byPriority: formattedPriorityStats,
        overdue: overdueCount,
        upcoming: upcomingCount,
        completionStats: {
          onTime: onTimeCount,
          late: lateCount,
          total: completedTasks.length,
          completionRate:
            completedTasks.length > 0
              ? ((onTimeCount / completedTasks.length) * 100).toFixed(2)
              : 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
