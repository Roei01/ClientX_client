const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipients: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      readAt: {
        type: Date,
        default: null,
      },
    },
  ],
  subject: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  attachments: [
    {
      fileName: String,
      fileType: String,
      fileSize: Number,
      filePath: String,
    },
  ],
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  isPriority: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for efficient searching
messageSchema.index({ sender: 1 });
messageSchema.index({ "recipients.user": 1 });
messageSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
messageSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
