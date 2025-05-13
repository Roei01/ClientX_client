const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { authenticateJWT, isActiveUser } = require("../middlewares/auth");

// Get all notifications for the current user
router.get("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Build query
    const query = { user: userId };

    // Filter by read status
    if (req.query.read === "true") {
      query.read = true;
    } else if (req.query.read === "false") {
      query.read = false;
    }

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by action required
    if (req.query.actionRequired === "true") {
      query.isActionRequired = true;
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sort options (default: newest first)
    const sortOptions = { createdAt: -1 };

    // Get notifications
    const notifications = await Notification.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalNotifications = await Notification.countDocuments(query);

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      user: userId,
      read: false,
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        total: totalNotifications,
        page,
        limit,
        pages: Math.ceil(totalNotifications / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark a notification as read
router.put("/:id/read", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    // Check if notification belongs to the user
    if (notification.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this notification",
      });
    }

    // Update read status
    if (!notification.read) {
      notification.read = true;
      notification.readAt = Date.now();
      await notification.save();
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark a notification as unread
router.put("/:id/unread", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    // Check if notification belongs to the user
    if (notification.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this notification",
      });
    }

    // Update read status
    notification.read = false;
    notification.readAt = null;
    await notification.save();

    res.json({ success: true, message: "Notification marked as unread" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark all notifications as read
router.post(
  "/mark-all-read",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      const userId = req.user._id;

      // Build query based on filters
      const query = {
        user: userId,
        read: false,
      };

      // Filter by type if specified
      if (req.body.type) {
        query.type = req.body.type;
      }

      // Update all matching notifications
      const result = await Notification.updateMany(query, {
        $set: {
          read: true,
          readAt: Date.now(),
        },
      });

      res.json({
        success: true,
        message: `${result.nModified} notifications marked as read`,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Delete a notification
router.delete("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    // Check if notification belongs to the user
    if (notification.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this notification",
      });
    }

    // Delete the notification
    await Notification.findByIdAndDelete(notificationId);

    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete all read notifications
router.delete(
  "/clear-read",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      const userId = req.user._id;

      // Find and delete all read notifications for this user
      const result = await Notification.deleteMany({
        user: userId,
        read: true,
      });

      res.json({
        success: true,
        message: `${result.deletedCount} read notifications cleared`,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get notification statistics
router.get("/stats", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get counts by type
    const typeStats = await Notification.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] } },
        },
      },
    ]);

    // Format type stats
    const formattedTypeStats = {};
    typeStats.forEach((stat) => {
      formattedTypeStats[stat._id] = {
        total: stat.count,
        unread: stat.unread,
      };
    });

    // Get action required count
    const actionRequiredCount = await Notification.countDocuments({
      user: userId,
      isActionRequired: true,
      read: false,
    });

    // Get stats by time periods
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const today = await Notification.countDocuments({
      user: userId,
      createdAt: { $gte: todayStart },
    });

    const yesterday = await Notification.countDocuments({
      user: userId,
      createdAt: { $gte: yesterdayStart, $lt: todayStart },
    });

    const thisWeek = await Notification.countDocuments({
      user: userId,
      createdAt: { $gte: weekStart },
    });

    res.json({
      success: true,
      statistics: {
        byType: formattedTypeStats,
        actionRequired: actionRequiredCount,
        timePeriods: {
          today,
          yesterday,
          thisWeek,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create a notification utility function (for internal use)
const createNotification = async (data) => {
  try {
    const { user, title, content, type, relatedDocument, isActionRequired } =
      data;

    const notification = new Notification({
      user,
      title,
      content,
      type,
      relatedDocument,
      isActionRequired: isActionRequired || false,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

// Attach the utility function to the router object
router.createNotification = createNotification;

module.exports = router;
