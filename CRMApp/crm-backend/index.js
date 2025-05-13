const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketIo = require("socket.io");
const passport = require("passport");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const path = require("path");
const winston = require("winston");
const User = require("./models/User");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// Load environment variables from .env file
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Apply security middlewares
app.use(helmet());
app.use(compression());
app.use(mongoSanitize());
app.use(cookieParser());

// Configure CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// Request body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configure JWT authentication
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "default_jwt_secret",
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        // Update last active time
        user.lastActive = new Date();
        await user.save();
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      logger.error("JWT Strategy error:", error);
      return done(error, false);
    }
  })
);

app.use(passport.initialize());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://royinaar5:gfnxe1YMpZiziAoJ@crmclusters.ujlvsee.mongodb.net/",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => logger.info("Connected to MongoDB"))
  .catch((err) => logger.error("Could not connect to MongoDB", err));

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Socket.io setup
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on("join", (userData) => {
    if (userData && userData.userId) {
      socket.join(userData.userId);
      logger.info(`User ${userData.userId} joined their room`);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

app.set("socketio", io);

// Import routes
const authRoute = require("./routes/auth");
const clientsRoute = require("./routes/clients");
const usersRoute = require("./routes/users");
const tasksRoute = require("./routes/tasks");
const teamsRoute = require("./routes/teams");
const messagesRoute = require("./routes/messages");
const notificationsRoute = require("./routes/notifications");
const importExportRoute = require("./routes/import-export");
// These routes don't exist yet - uncomment when implemented
const dashboardRoute = require("./routes/dashboard");
// const reportsRoute = require("./routes/reports");
// const settingsRoute = require("./routes/settings");
// const backupRoute = require("./routes/backup");
// const aiRoute = require("./routes/ai");

// Register routes
app.use("/api/auth", authRoute);
app.use("/api/clients", clientsRoute);
app.use("/api/users", usersRoute);
app.use("/api/tasks", tasksRoute);
app.use("/api/teams", teamsRoute);
app.use("/api/messages", messagesRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/import-export", importExportRoute);
// Register these routes when implemented
app.use("/api/dashboard", dashboardRoute);
// app.use("/api/reports", reportsRoute);
// app.use("/api/settings", settingsRoute);
// app.use("/api/backup", backupRoute);
// app.use("/api/ai", aiRoute);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});

// Start the server
const PORT = process.env.PORT || 30000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle process termination gracefully
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  });
});

// Export app for testing
module.exports = app;
