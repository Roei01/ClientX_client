const mongoose = require("mongoose");

const contactPersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  position: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
});

const noteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
  },
  details: {
    type: Object,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  company: {
    type: String,
  },
  industry: {
    type: String,
  },
  website: {
    type: String,
  },
  contactPersons: [contactPersonSchema],
  status: {
    type: String,
    enum: ["lead", "prospect", "customer", "inactive"],
    default: "lead",
  },
  source: {
    type: String,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  tags: [
    {
      type: String,
    },
  ],
  notes: [noteSchema],
  activityLog: [activityLogSchema],
  lastContact: {
    type: Date,
  },
  preferredLanguage: {
    type: String,
    default: "he",
  },
  preferredCurrency: {
    type: String,
    default: "ILS",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

// Add indexes for efficient searching
clientSchema.index({ name: "text", email: "text", company: "text" });

// Update the updatedAt field before saving
clientSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Client = mongoose.model("Client", clientSchema);

module.exports = Client;
