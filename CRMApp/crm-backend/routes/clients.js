const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Client = require("../models/Client");
const User = require("../models/User");
const SystemLog = require("../models/SystemLog");
const {
  authenticateJWT,
  isActiveUser,
  canManageClient,
} = require("../middlewares/auth");

// Get all clients with filtering
router.get("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    // Build query based on user role and filters
    const query = {};

    // Role-based access control for clients
    if (req.user.role === "employee") {
      // Employees can only see clients assigned to them
      query.assignedTo = req.user._id;
    } else if (req.user.role === "teamLeader") {
      // Team leaders can see clients assigned to their team members or themselves
      const Team = require("../models/Team");

      const teams = await Team.find({ teamLeader: req.user._id });
      if (teams.length === 0) {
        // If no teams, only show own clients
        query.assignedTo = req.user._id;
      } else {
        // Get team member IDs
        const teamMemberIds = teams.flatMap((team) => team.members);
        teamMemberIds.push(req.user._id); // Include team leader

        query.assignedTo = { $in: teamMemberIds };
      }
    }
    // Admins and managers can see all clients, so no additional filter

    // Apply filters from request query
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.assignedTo) {
      // Validate permission to view clients for this assignee
      if (
        req.user.role === "employee" &&
        req.query.assignedTo !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view clients assigned to others",
        });
      }

      // If authorized, apply the filter
      query.assignedTo = mongoose.Types.ObjectId(req.query.assignedTo);
    }

    // Text search
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(",");
      query.tags = { $in: tags };
    }

    // Filter by industry
    if (req.query.industry) {
      query.industry = req.query.industry;
    }

    // Filter by creation date range
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      query.createdAt = { $gte: startDate, $lte: endDate };
    } else if (req.query.startDate) {
      const startDate = new Date(req.query.startDate);
      query.createdAt = { $gte: startDate };
    } else if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      query.createdAt = { $lte: endDate };
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

    // Get clients
    const clients = await Client.find(query)
      .populate("assignedTo", "username firstName lastName")
      .populate("createdBy", "username firstName lastName")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const totalClients = await Client.countDocuments(query);

    res.json({
      success: true,
      clients,
      pagination: {
        total: totalClients,
        page,
        limit,
        pages: Math.ceil(totalClients / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get client by ID
router.get(
  "/:id",
  authenticateJWT,
  isActiveUser,
  canManageClient,
  async (req, res) => {
    try {
      const clientId = req.params.id;

      const client = await Client.findById(clientId)
        .populate(
          "assignedTo",
          "username firstName lastName email phone avatar"
        )
        .populate("createdBy", "username firstName lastName")
        .populate("notes.createdBy", "username firstName lastName avatar")
        .populate("activityLog.performedBy", "username firstName lastName");

      if (!client) {
        return res
          .status(404)
          .json({ success: false, message: "Client not found" });
      }

      res.json({ success: true, client });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Create a new client
router.post("/", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      company,
      industry,
      website,
      contactPersons,
      status,
      source,
      tags,
      assignedTo,
      preferredLanguage,
      preferredCurrency,
    } = req.body;

    // Check if client email already exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Client with this email already exists",
        });
    }

    // Create new client
    const newClient = new Client({
      name,
      email,
      phone,
      address,
      company,
      industry,
      website,
      contactPersons: contactPersons || [],
      status: status || "lead",
      source,
      tags: tags || [],
      assignedTo: assignedTo || req.user._id,
      preferredLanguage,
      preferredCurrency,
      createdBy: req.user._id,
    });

    await newClient.save();

    // Add activity log entry
    newClient.activityLog.push({
      action: "created",
      details: {
        message: "Client was created",
      },
      performedBy: req.user._id,
    });

    await newClient.save();

    // Log the client creation
    const systemLog = new SystemLog({
      action: "create",
      entityType: "Client",
      entityId: newClient._id,
      newState: {
        name: newClient.name,
        email: newClient.email,
        status: newClient.status,
        assignedTo: newClient.assignedTo,
      },
      user: req.user._id,
      details: `Client ${newClient.name} created by ${req.user.username}`,
    });

    await systemLog.save();

    // Return the created client
    const createdClient = await Client.findById(newClient._id)
      .populate("assignedTo", "username firstName lastName")
      .populate("createdBy", "username firstName lastName");

    res.status(201).json({ success: true, client: createdClient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a client
router.put(
  "/:id",
  authenticateJWT,
  isActiveUser,
  canManageClient,
  async (req, res) => {
    try {
      const clientId = req.params.id;

      // Get current client state for logging
      const currentClient = await Client.findById(clientId);
      if (!currentClient) {
        return res
          .status(404)
          .json({ success: false, message: "Client not found" });
      }

      const {
        name,
        email,
        phone,
        address,
        company,
        industry,
        website,
        contactPersons,
        status,
        source,
        tags,
        assignedTo,
        preferredLanguage,
        preferredCurrency,
      } = req.body;

      // Prepare updates
      const updates = {};

      if (name !== undefined) updates.name = name;
      if (email !== undefined) {
        // Check if email is changed and not already in use
        if (email !== currentClient.email) {
          const existingClient = await Client.findOne({
            email,
            _id: { $ne: clientId },
          });
          if (existingClient) {
            return res
              .status(400)
              .json({
                success: false,
                message: "Another client with this email already exists",
              });
          }
          updates.email = email;
        }
      }
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (company !== undefined) updates.company = company;
      if (industry !== undefined) updates.industry = industry;
      if (website !== undefined) updates.website = website;
      if (contactPersons !== undefined) updates.contactPersons = contactPersons;
      if (status !== undefined) updates.status = status;
      if (source !== undefined) updates.source = source;
      if (tags !== undefined) updates.tags = tags;
      if (preferredLanguage !== undefined)
        updates.preferredLanguage = preferredLanguage;
      if (preferredCurrency !== undefined)
        updates.preferredCurrency = preferredCurrency;

      // Handle assignedTo change
      if (
        assignedTo !== undefined &&
        assignedTo !== currentClient.assignedTo?.toString()
      ) {
        // Validate new assignee exists
        const assignee = await User.findById(assignedTo);
        if (!assignee) {
          return res
            .status(400)
            .json({ success: false, message: "Assigned user not found" });
        }

        updates.assignedTo = assignedTo;

        // Add activity log entry for reassignment
        currentClient.activityLog.push({
          action: "reassigned",
          details: {
            previousAssignee: currentClient.assignedTo,
            newAssignee: assignedTo,
          },
          performedBy: req.user._id,
        });
      }

      // Record status change in activity log
      if (status !== undefined && status !== currentClient.status) {
        currentClient.activityLog.push({
          action: "status_changed",
          details: {
            previousStatus: currentClient.status,
            newStatus: status,
          },
          performedBy: req.user._id,
        });
      }

      // Add updatedAt timestamp
      updates.updatedAt = Date.now();

      // Update the client
      await currentClient.save(); // Save activity log changes

      const updatedClient = await Client.findByIdAndUpdate(
        clientId,
        { $set: updates },
        { new: true }
      )
        .populate("assignedTo", "username firstName lastName")
        .populate("createdBy", "username firstName lastName")
        .populate("notes.createdBy", "username firstName lastName avatar")
        .populate("activityLog.performedBy", "username firstName lastName");

      // Log the update
      const systemLog = new SystemLog({
        action: "update",
        entityType: "Client",
        entityId: clientId,
        previousState: {
          name: currentClient.name,
          email: currentClient.email,
          status: currentClient.status,
          assignedTo: currentClient.assignedTo,
        },
        newState: {
          name: updatedClient.name,
          email: updatedClient.email,
          status: updatedClient.status,
          assignedTo: updatedClient.assignedTo,
        },
        user: req.user._id,
        details: `Client ${currentClient.name} updated by ${req.user.username}`,
      });

      await systemLog.save();

      res.json({ success: true, client: updatedClient });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Delete a client
router.delete("/:id", authenticateJWT, isActiveUser, async (req, res) => {
  try {
    const clientId = req.params.id;

    // Check authorization - only admin and manager can delete clients
    if (req.user.role !== "admin" && req.user.role !== "manager") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to delete clients" });
    }

    // Get client for logging
    const client = await Client.findById(clientId);
    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found" });
    }

    // Log the deletion
    const systemLog = new SystemLog({
      action: "delete",
      entityType: "Client",
      entityId: clientId,
      previousState: {
        name: client.name,
        email: client.email,
        status: client.status,
        assignedTo: client.assignedTo,
      },
      user: req.user._id,
      details: `Client ${client.name} deleted by ${req.user.username}`,
    });

    await systemLog.save();

    // Delete the client
    await Client.findByIdAndDelete(clientId);

    res.json({ success: true, message: "Client deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a note to a client
router.post(
  "/:id/notes",
  authenticateJWT,
  isActiveUser,
  canManageClient,
  async (req, res) => {
    try {
      const clientId = req.params.id;
      const { content } = req.body;

      const client = await Client.findById(clientId);
      if (!client) {
        return res
          .status(404)
          .json({ success: false, message: "Client not found" });
      }

      // Add the note
      client.notes.push({
        content,
        createdBy: req.user._id,
        createdAt: Date.now(),
      });

      // Add activity log entry
      client.activityLog.push({
        action: "note_added",
        details: {
          noteId: client.notes[client.notes.length - 1]._id,
        },
        performedBy: req.user._id,
      });

      await client.save();

      // Return the updated client with populated fields
      const updatedClient = await Client.findById(clientId)
        .populate("assignedTo", "username firstName lastName")
        .populate("notes.createdBy", "username firstName lastName avatar")
        .populate("activityLog.performedBy", "username firstName lastName");

      res.json({ success: true, client: updatedClient });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Add or update a contact person for a client
router.post(
  "/:id/contacts",
  authenticateJWT,
  isActiveUser,
  canManageClient,
  async (req, res) => {
    try {
      const clientId = req.params.id;
      const { name, position, email, phone, contactId } = req.body;

      const client = await Client.findById(clientId);
      if (!client) {
        return res
          .status(404)
          .json({ success: false, message: "Client not found" });
      }

      // Check if updating existing contact or adding new one
      if (contactId) {
        // Find and update existing contact
        const contactIndex = client.contactPersons.findIndex(
          (contact) => contact._id.toString() === contactId
        );

        if (contactIndex === -1) {
          return res
            .status(404)
            .json({ success: false, message: "Contact person not found" });
        }

        if (name) client.contactPersons[contactIndex].name = name;
        if (position) client.contactPersons[contactIndex].position = position;
        if (email) client.contactPersons[contactIndex].email = email;
        if (phone) client.contactPersons[contactIndex].phone = phone;

        // Add activity log entry
        client.activityLog.push({
          action: "contact_updated",
          details: {
            contactId,
            contactName: client.contactPersons[contactIndex].name,
          },
          performedBy: req.user._id,
        });
      } else {
        // Add new contact
        const newContact = {
          name,
          position,
          email,
          phone,
        };

        client.contactPersons.push(newContact);

        // Add activity log entry
        client.activityLog.push({
          action: "contact_added",
          details: {
            contactId:
              client.contactPersons[client.contactPersons.length - 1]._id,
            contactName: name,
          },
          performedBy: req.user._id,
        });
      }

      await client.save();

      // Return the updated client
      const updatedClient = await Client.findById(clientId)
        .populate("assignedTo", "username firstName lastName")
        .populate("activityLog.performedBy", "username firstName lastName");

      res.json({ success: true, client: updatedClient });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Delete a contact person
router.delete(
  "/:id/contacts/:contactId",
  authenticateJWT,
  isActiveUser,
  canManageClient,
  async (req, res) => {
    try {
      const { id: clientId, contactId } = req.params;

      const client = await Client.findById(clientId);
      if (!client) {
        return res
          .status(404)
          .json({ success: false, message: "Client not found" });
      }

      // Find contact
      const contactIndex = client.contactPersons.findIndex(
        (contact) => contact._id.toString() === contactId
      );

      if (contactIndex === -1) {
        return res
          .status(404)
          .json({ success: false, message: "Contact person not found" });
      }

      // Store contact name for activity log
      const contactName = client.contactPersons[contactIndex].name;

      // Remove contact
      client.contactPersons.splice(contactIndex, 1);

      // Add activity log entry
      client.activityLog.push({
        action: "contact_deleted",
        details: {
          contactName,
        },
        performedBy: req.user._id,
      });

      await client.save();

      res.json({
        success: true,
        message: "Contact person deleted successfully",
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Get client statistics
router.get(
  "/stats/summary",
  authenticateJWT,
  isActiveUser,
  async (req, res) => {
    try {
      // Build base query based on user role
      let baseQuery = {};

      if (req.user.role === "employee") {
        baseQuery.assignedTo = req.user._id;
      } else if (req.user.role === "teamLeader") {
        const Team = require("../models/Team");
        const teams = await Team.find({ teamLeader: req.user._id });
        const teamMemberIds = teams.flatMap((team) => team.members);
        teamMemberIds.push(req.user._id);

        baseQuery.assignedTo = { $in: teamMemberIds };
      }

      // Get counts by status
      const statusStats = await Client.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      // Format status stats
      const formattedStatusStats = {
        lead: 0,
        prospect: 0,
        customer: 0,
        inactive: 0,
      };

      statusStats.forEach((stat) => {
        formattedStatusStats[stat._id] = stat.count;
      });

      // Get counts by source
      const sourceStats = await Client.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]);

      // Format source stats (keep top sources and group others)
      const sourceMap = {};
      let totalSources = 0;

      sourceStats.forEach((stat) => {
        if (stat._id) {
          sourceMap[stat._id] = stat.count;
          totalSources += stat.count;
        }
      });

      // Sort sources by count
      const topSources = Object.entries(sourceMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((acc, [source, count]) => {
          acc[source] = count;
          return acc;
        }, {});

      // Get counts by creation date (monthly for past year)
      const now = new Date();
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      const monthlyStats = await Client.aggregate([
        {
          $match: {
            ...baseQuery,
            createdAt: { $gte: lastYear },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      // Format monthly stats
      const formattedMonthlyStats = [];

      for (let i = 0; i < 12; i++) {
        const date = new Date(now);
        date.setMonth(now.getMonth() - i);

        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        const stat = monthlyStats.find(
          (s) => s._id.year === year && s._id.month === month
        );

        formattedMonthlyStats.unshift({
          date: `${year}-${month.toString().padStart(2, "0")}`,
          count: stat ? stat.count : 0,
        });
      }

      // Return stats summary
      res.json({
        success: true,
        statistics: {
          byStatus: formattedStatusStats,
          bySources: topSources,
          monthly: formattedMonthlyStats,
          total: await Client.countDocuments(baseQuery),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
