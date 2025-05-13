const express = require("express");
const router = express.Router();
const passport = require("passport");
const Client = require("../models/Client");
const User = require("../models/User");
const Task = require("../models/Task");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

// Get dashboard stats
router.get(
  "/",
  (req, res, next) => {
    console.log("Dashboard request received");
    console.log("Authorization header:", req.headers.authorization);
    next();
  },
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      console.log("User authenticated:", req.user._id);

      // Get stats from various collections
      const totalClients = await Client.countDocuments();
      const totalUsers = await User.countDocuments();
      const pendingTasks = await Task.countDocuments({
        status: { $ne: "completed" },
      });
      const completedTasks = await Task.countDocuments({ status: "completed" });

      // Get unread messages for the current user
      const unreadMessages = await Message.countDocuments({
        "recipients.user": req.user._id,
        "recipients.readAt": null,
      });

      // Get unread notifications for the current user
      const unreadNotifications = await Notification.countDocuments({
        user: req.user._id,
        isRead: false,
      });

      console.log("Sending dashboard data");

      // Return all stats
      return res.status(200).json({
        success: true,
        data: {
          totalClients,
          totalUsers,
          pendingTasks,
          completedTasks,
          unreadMessages,
          unreadNotifications,
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      return res.status(500).json({
        success: false,
        message: "Error fetching dashboard data",
        error: error.message,
      });
    }
  }
);

module.exports = router;
