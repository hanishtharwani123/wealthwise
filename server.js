// server.js - Complete implementation with chatbot functionality
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const OpenAI = require("openai");

// Initialize Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from 'public' directory

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This should be set in your .env file
});

// Check for required environment variables
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1); // Stop the server if no MongoDB URI
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is not defined in .env file");
  console.warn("⚠️ Chatbot will not function without an OpenAI API key");
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Define User Schema & Model
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);

// ===== API ROUTES =====

// Signup Route
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Registered Successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    res.status(200).json({
      message: "Login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Chatbot API Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "Chatbot service is unavailable",
        details: "API key not configured",
      });
    }

    // Call OpenAI API
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant for WealthWise, a financial services company. Provide helpful, concise information about personal finance, investing, budgeting, and wealth management. Keep responses professional, informative, and focused on financial topics. Limit responses to 3-4 sentences when possible.",
          },
          { role: "user", content: message },
        ],
        max_tokens: 500, // Limit response length
      });
      console.log(
        "OpenAI API response:",
        response.choices[0].message.content // Log the AI's response for debugging
      );

      const aiResponse = response.choices[0].message.content;

      res.json({ response: aiResponse });
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);

      // Fallback response if OpenAI API fails
      return res.json({
        response:
          "I'm sorry, I'm having trouble processing your request right now. Our financial advisors are available during business hours if you have urgent questions. Please try again later or contact our support team.",
        fallback: true,
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: "Failed to process your request",
      details: error.message,
    });
  }
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// ===== SERVING STATIC FILES =====

// Serve the static files from the React app in production
// For development, this would be handled by your frontend dev server
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== ERROR HANDLING =====

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// ===== SERVER STARTUP =====

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/test`);

  // Log environment info
  console.log(`🔐 Auth routes: Enabled`);
  console.log(
    `🤖 Chatbot: ${
      process.env.OPENAI_API_KEY ? "Enabled" : "Disabled (No API key)"
    }`
  );
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});
