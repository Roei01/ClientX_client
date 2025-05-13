const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs-extra");
const Client = require("../models/Client");
const SystemLog = require("../models/SystemLog");
const { authenticateJWT, authorize } = require("../middlewares/auth");

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    fs.ensureDirSync(uploadDir); // Make sure the directory exists
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// File filter - only accept Excel files
const fileFilter = (req, file, cb) => {
  const filetypes = /xlsx|xls/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Import clients from Excel
router.post(
  "/import-clients",
  authenticateJWT,
  authorize("admin", "manager", "teamLeader"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      // Read the Excel file
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No data in the Excel file" });
      }

      // Process client data and import to database
      const importResults = {
        total: data.length,
        imported: 0,
        errors: [],
      };

      for (const row of data) {
        try {
          // Validate required fields
          if (!row.name || !row.email) {
            importResults.errors.push({
              row,
              error: "Missing required fields (name, email)",
            });
            continue;
          }

          // Check if client already exists
          const existingClient = await Client.findOne({ email: row.email });
          if (existingClient) {
            // Update existing client
            Object.assign(existingClient, {
              name: row.name,
              phone: row.phone,
              address: row.address,
              industry: row.industry,
              status: row.status || "active",
              updatedBy: req.user._id,
              updatedAt: Date.now(),
            });

            await existingClient.save();
          } else {
            // Create new client
            const newClient = new Client({
              name: row.name,
              email: row.email,
              phone: row.phone,
              address: row.address,
              industry: row.industry,
              status: row.status || "active",
              notes: row.notes || "",
              createdBy: req.user._id,
              assignedTo: row.assignedTo || req.user._id,
            });

            await newClient.save();
          }

          importResults.imported++;
        } catch (error) {
          importResults.errors.push({ row, error: error.message });
        }
      }

      // Log the import
      const systemLog = new SystemLog({
        action: "import",
        entityType: "Client",
        user: req.user._id,
        details: `Imported ${importResults.imported} clients from Excel file by ${req.user.username}`,
        ipAddress: req.ip,
      });

      await systemLog.save();

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.status(200).json({
        success: true,
        message: `Imported ${importResults.imported} of ${importResults.total} clients successfully`,
        results: importResults,
      });
    } catch (error) {
      console.error("Excel import error:", error);

      // Clean up if file exists
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Export clients to Excel
router.get(
  "/export-clients",
  authenticateJWT,
  authorize("admin", "manager", "teamLeader"),
  async (req, res) => {
    try {
      // Query parameters for filtering
      const filters = {};

      if (req.query.status) filters.status = req.query.status;
      if (req.query.industry) filters.industry = req.query.industry;

      // For team leaders, only export assigned clients or team members' clients
      if (req.user.role === "teamLeader") {
        // Handle team-based permissions here
      }

      // Get clients from database
      const clients = await Client.find(filters)
        .populate("assignedTo", "username firstName lastName")
        .populate("createdBy", "username");

      if (clients.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No clients found to export" });
      }

      // Prepare data for export
      const exportData = clients.map((client) => ({
        ID: client._id.toString(),
        Name: client.name,
        Email: client.email,
        Phone: client.phone,
        Address: client.address,
        Industry: client.industry,
        Status: client.status,
        AssignedTo: client.assignedTo
          ? `${client.assignedTo.firstName} ${client.assignedTo.lastName} (${client.assignedTo.username})`
          : "None",
        CreatedBy: client.createdBy ? client.createdBy.username : "System",
        CreatedAt: client.createdAt.toISOString().split("T")[0],
        LastUpdated: client.updatedAt
          ? client.updatedAt.toISOString().split("T")[0]
          : "",
      }));

      // Create Excel workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");

      // Generate a temporary file path
      const exportDir = path.join(__dirname, "../exports");
      fs.ensureDirSync(exportDir);

      const filename = `clients-export-${Date.now()}.xlsx`;
      const filePath = path.join(exportDir, filename);

      // Write file to disk
      XLSX.writeFile(workbook, filePath);

      // Log the export
      const systemLog = new SystemLog({
        action: "export",
        entityType: "Client",
        user: req.user._id,
        details: `Exported ${clients.length} clients to Excel by ${req.user.username}`,
        ipAddress: req.ip,
      });

      await systemLog.save();

      // Send the file to client
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error("Download error:", err);
        }

        // Clean up the file after download
        fs.unlinkSync(filePath);
      });
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Download a template Excel file
router.get(
  "/template",
  authenticateJWT,
  authorize("admin", "manager", "teamLeader"),
  async (req, res) => {
    try {
      // Create sample data
      const sampleData = [
        {
          name: "Sample Client 1",
          email: "sample1@example.com",
          phone: "123-456-7890",
          address: "123 Main St, City, Country",
          industry: "Technology",
          status: "active",
          notes: "Sample notes about this client",
        },
        {
          name: "Sample Client 2",
          email: "sample2@example.com",
          phone: "098-765-4321",
          address: "456 Business Ave, City, Country",
          industry: "Healthcare",
          status: "lead",
          notes: "This is a prospective client",
        },
      ];

      // Create Excel workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sampleData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

      // Generate a temporary file path
      const exportDir = path.join(__dirname, "../exports");
      fs.ensureDirSync(exportDir);

      const filename = `client-import-template.xlsx`;
      const filePath = path.join(exportDir, filename);

      // Write file to disk
      XLSX.writeFile(workbook, filePath);

      // Send the file to client
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error("Template download error:", err);
        }

        // Clean up the file after download
        fs.unlinkSync(filePath);
      });
    } catch (error) {
      console.error("Template generation error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
