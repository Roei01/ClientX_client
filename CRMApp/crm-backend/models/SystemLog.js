const mongoose = require("mongoose");

const systemLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      "create",
      "update",
      "delete",
      "import",
      "export",
      "backup",
      "restore",
      "login",
      "logout",
      "other",
    ],
  },
  entityType: {
    type: String,
    required: true,
    enum: [
      "User",
      "Client",
      "Task",
      "Team",
      "Message",
      "Notification",
      "System",
    ],
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  previousState: {
    type: Object,
  },
  newState: {
    type: Object,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  details: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isBackupPoint: {
    type: Boolean,
    default: false,
  },
  backupReference: {
    type: String,
  },
});

// Add indexes for efficient searching
systemLogSchema.index({ action: 1, entityType: 1 });
systemLogSchema.index({ user: 1 });
systemLogSchema.index({ timestamp: -1 });
systemLogSchema.index({ isBackupPoint: 1 });

const SystemLog = mongoose.model("SystemLog", systemLogSchema);

module.exports = SystemLog;
