const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const SystemLog = require("../models/SystemLog");
const { authenticateJWT, isActiveUser } = require("../middlewares/auth");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/messages");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    // Accept common file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, Office documents and text files are allowed."
        )
      );
    }
  },
});

// Get all messages for the current user
router.get("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const userId = req.user._id;

    // Filter messages
    const filter = {};

    if (req.query.folder === "sent") {
      // Show sent messages
      filter.sender = userId;
    } else if (req.query.folder === "archived") {
      // Show archived messages
      filter["recipients.user"] = userId;
      filter["recipients.isArchived"] = true;
    } else {
      // Default: show inbox (received messages)
      filter["recipients.user"] = userId;
      filter["recipients.isArchived"] = { $ne: true };
    }

    // Filter by priority
    if (req.query.priority === "true") {
      filter.isPriority = true;
    }

    // Search by subject or content
    if (req.query.search) {
      filter.$or = [
        { subject: { $regex: req.query.search, $options: "i" } },
        { content: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sort options
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;

    // Get messages
    const messages = await Message.find(filter)
      .populate("sender", "username firstName lastName avatar")
      .populate("recipients.user", "username firstName lastName")
      .populate("parentMessage", "subject")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Format messages for the recipient view
    const formattedMessages = messages.map((message) => {
      const formattedMessage = message.toObject();

      // Add a read status for the current user
      if (filter["recipients.user"]) {
        const recipientData = message.recipients.find(
          (r) => r.user && r.user._id.toString() === userId.toString()
        );

        if (recipientData) {
          formattedMessage.isRead = !!recipientData.readAt;
          formattedMessage.readAt = recipientData.readAt;
        }
      }

      return formattedMessage;
    });

    const totalMessages = await Message.countDocuments(filter);

    // Count unread messages for the user
    const unreadCount = await Message.countDocuments({
      "recipients.user": userId,
      "recipients.readAt": null,
      "recipients.isArchived": { $ne: true },
    });

    res.json({
      success: true,
      messages: formattedMessages,
      unreadCount,
      pagination: {
        total: totalMessages,
        page,
        limit,
        pages: Math.ceil(totalMessages / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get a specific message
router.get("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId)
      .populate("sender", "username firstName lastName email avatar")
      .populate("recipients.user", "username firstName lastName email")
      .populate("parentMessage");

    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender or a recipient
    const isSender = message.sender._id.toString() === userId.toString();
    const isRecipient = message.recipients.some(
      (r) => r.user && r.user._id.toString() === userId.toString()
    );

    if (!isSender && !isRecipient) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to view this message",
        });
    }

    // If user is recipient and hasn't read the message, mark as read
    if (isRecipient) {
      const recipientIndex = message.recipients.findIndex(
        (r) => r.user && r.user._id.toString() === userId.toString()
      );

      if (recipientIndex !== -1 && !message.recipients[recipientIndex].readAt) {
        message.recipients[recipientIndex].readAt = Date.now();
        await message.save();
      }
    }

    const formattedMessage = message.toObject();

    // Add a read status for the current user if they're a recipient
    if (isRecipient) {
      const recipientData = message.recipients.find(
        (r) => r.user && r.user._id.toString() === userId.toString()
      );

      formattedMessage.isRead = !!recipientData.readAt;
      formattedMessage.readAt = recipientData.readAt;
    }

    // Get thread if it exists (all messages with same parent or that are parents of this message)
    let thread = [];
    if (message.parentMessage) {
      // This is a reply - get the whole thread
      thread = await Message.find({
        $or: [
          { _id: message.parentMessage._id },
          { parentMessage: message.parentMessage._id },
        ],
      })
        .sort({ createdAt: 1 })
        .populate("sender", "username firstName lastName avatar")
        .populate("recipients.user", "username firstName lastName");
    } else {
      // This is a parent message - get all replies
      const replies = await Message.find({ parentMessage: message._id })
        .sort({ createdAt: 1 })
        .populate("sender", "username firstName lastName avatar")
        .populate("recipients.user", "username firstName lastName");

      thread = [message, ...replies];
    }

    res.json({
      success: true,
      message: formattedMessage,
      thread,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send a new message
router.post(
  "/",
  authenticateJWT,
  isActiveUser,
  upload.array("attachments", 5),
  async (req, res) => {
    try {
      const { subject, content, recipients, isPriority, parentMessageId } =
        req.body;
      const sender = req.user._id;

      // Validate recipients
      if (
        !recipients ||
        !Array.isArray(JSON.parse(recipients)) ||
        JSON.parse(recipients).length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "At least one recipient is required",
          });
      }

      const recipientIds = JSON.parse(recipients);

      // Validate that recipients exist
      const validRecipients = await User.find({
        _id: { $in: recipientIds },
        isActive: true,
      });

      if (validRecipients.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No valid recipients found" });
      }

      // Format recipients for the message
      const formattedRecipients = validRecipients.map((recipient) => ({
        user: recipient._id,
        readAt: null,
      }));

      // Process attachments if any
      const attachments = [];
      if (req.files && req.files.length > 0) {
        attachments.push(
          ...req.files.map((file) => ({
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          }))
        );
      }

      // Create the message
      const newMessage = new Message({
        sender,
        recipients: formattedRecipients,
        subject,
        content,
        attachments,
        isPriority: isPriority === "true",
        parentMessage: parentMessageId || null,
      });

      await newMessage.save();

      // Create notifications for recipients
      const io = req.app.get("socketio");
      const senderUser = await User.findById(
        sender,
        "username firstName lastName"
      );

      for (const recipient of validRecipients) {
        // Create notification
        const notification = new Notification({
          user: recipient._id,
          title: isPriority === "true" ? "⚠️ Priority Message" : "New Message",
          content: `${senderUser.firstName} ${senderUser.lastName}: ${subject}`,
          type: "message",
          relatedDocument: {
            documentType: "Message",
            documentId: newMessage._id,
          },
        });

        await notification.save();

        // Send socket notification if user is online
        if (io) {
          io.to(recipient._id.toString()).emit("notification", {
            type: "message",
            message: `New message from ${senderUser.firstName} ${senderUser.lastName}: ${subject}`,
            messageId: newMessage._id,
          });
        }
      }

      // Log the message sending
      const systemLog = new SystemLog({
        action: "create",
        entityType: "Message",
        entityId: newMessage._id,
        newState: {
          subject: newMessage.subject,
          recipientsCount: newMessage.recipients.length,
          isPriority: newMessage.isPriority,
        },
        user: sender,
        details: `Message "${subject}" sent by ${senderUser.username} to ${validRecipients.length} recipients`,
      });

      await systemLog.save();

      // Return the new message with populated fields
      const createdMessage = await Message.findById(newMessage._id)
        .populate("sender", "username firstName lastName avatar")
        .populate("recipients.user", "username firstName lastName");

      res.status(201).json({ success: true, message: createdMessage });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Mark message as read
router.put("/:id/read", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check if user is a recipient
    const recipientIndex = message.recipients.findIndex(
      (r) => r.user && r.user.toString() === userId.toString()
    );

    if (recipientIndex === -1) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to mark this message as read",
        });
    }

    // Update read status if not already read
    if (!message.recipients[recipientIndex].readAt) {
      message.recipients[recipientIndex].readAt = Date.now();
      await message.save();
    }

    res.json({ success: true, message: "Message marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark message as unread
router.put("/:id/unread", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check if user is a recipient
    const recipientIndex = message.recipients.findIndex(
      (r) => r.user && r.user.toString() === userId.toString()
    );

    if (recipientIndex === -1) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to mark this message as unread",
        });
    }

    // Update read status
    message.recipients[recipientIndex].readAt = null;
    await message.save();

    res.json({ success: true, message: "Message marked as unread" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Archive message
router.put("/:id/archive", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check if user is a recipient
    const recipientIndex = message.recipients.findIndex(
      (r) => r.user && r.user.toString() === userId.toString()
    );

    if (recipientIndex === -1) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to archive this message",
        });
    }

    // Update archived status
    message.recipients[recipientIndex].isArchived = true;
    await message.save();

    res.json({ success: true, message: "Message archived" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Unarchive message
router.put(
  "/:id/unarchive",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      const messageId = req.params.id;
      const userId = req.user._id;

      const message = await Message.findById(messageId);
      if (!message) {
        return res
          .status(404)
          .json({ success: false, message: "Message not found" });
      }

      // Check if user is a recipient
      const recipientIndex = message.recipients.findIndex(
        (r) => r.user && r.user.toString() === userId.toString()
      );

      if (recipientIndex === -1) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Not authorized to unarchive this message",
          });
      }

      // Update archived status
      message.recipients[recipientIndex].isArchived = false;
      await message.save();

      res.json({ success: true, message: "Message unarchived" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Delete message (only for sender)
router.delete("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only the sender can delete a message",
        });
    }

    // Delete any attachments
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        try {
          if (fs.existsSync(attachment.filePath)) {
            fs.unlinkSync(attachment.filePath);
          }
        } catch (err) {
          console.error(
            `Failed to delete attachment ${attachment.fileName}:`,
            err
          );
        }
      }
    }

    // Log the deletion
    const systemLog = new SystemLog({
      action: "delete",
      entityType: "Message",
      entityId: messageId,
      previousState: {
        subject: message.subject,
        recipientsCount: message.recipients.length,
      },
      user: userId,
      details: `Message "${message.subject}" deleted by sender`,
    });

    await systemLog.save();

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    // Delete related notifications
    await Notification.deleteMany({
      "relatedDocument.documentType": "Message",
      "relatedDocument.documentId": messageId,
    });

    res.json({ success: true, message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user contacts for messaging
router.get(
  "/contacts/list",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      // Get all active users, excluding the current user
      const users = await User.find({
        _id: { $ne: req.user._id },
        isActive: true,
      })
        .select("username firstName lastName avatar role team")
        .populate("team", "name");

      // Get list of users the current user has messaged with
      const recentContacts = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender: req.user._id },
              { "recipients.user": req.user._id },
            ],
          },
        },
        {
          $addFields: {
            contactIds: {
              $cond: {
                if: { $eq: ["$sender", req.user._id] },
                then: "$recipients.user",
                else: ["$sender"],
              },
            },
          },
        },
        { $unwind: "$contactIds" },
        {
          $group: {
            _id: "$contactIds",
            lastInteraction: { $max: "$createdAt" },
          },
        },
        { $sort: { lastInteraction: -1 } },
        { $limit: 10 },
      ]);

      const recentContactIds = recentContacts.map((contact) => contact._id);

      // Categorize users
      const team = await Team.findOne({ members: req.user._id });
      const teamId = team ? team._id : null;

      const contacts = {
        team: users.filter(
          (user) => user.team && user.team._id.toString() === teamId?.toString()
        ),
        recent: users.filter((user) => recentContactIds.includes(user._id)),
        all: users,
      };

      res.json({ success: true, contacts });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
