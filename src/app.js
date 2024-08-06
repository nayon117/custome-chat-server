require("dotenv").config(); 
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173", // Allow requests from this origin
    methods: ["GET", "POST"], // Allow these HTTP methods
  },
});

app.use(cors()); 
app.use(express.json()); 

// Connect to MongoDB database
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define ChatMessage schema and model
const ChatMessage = mongoose.model("ChatMessage", {
  userId: String,
  message: String,
  isAdmin: Boolean,
  timestamp: Date,
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId; // Get userId from query parameters

  socket.join(userId); // Join a room with the userId

  // Handle sendMessage event
  socket.on("sendMessage", async (message) => {
    const chatMessage = new ChatMessage({
      userId,
      message,
      isAdmin: false,
      timestamp: new Date(),
    });
    await chatMessage.save();
    io.to(userId).emit("message", chatMessage); // Emit message to the user
    io.to("admin").emit("newMessage", chatMessage); // Notify admin of the new message
  });

  // Handle adminReply event
  socket.on("adminReply", async ({ userId, message }) => {
    const chatMessage = new ChatMessage({
      userId,
      message,
      isAdmin: true,
      timestamp: new Date(),
    });
    await chatMessage.save();
    io.to(userId).emit("message", chatMessage); // Emit message to the user
    io.to("admin").emit("newMessage", chatMessage); // Notify admin of the reply
  });

  // Handle getHistory event
  socket.on("getHistory", async () => {
    const messages = await ChatMessage.find({ userId }).sort("timestamp");
    socket.emit("history", messages); // Send message history to the user
  });

  // Handle getAllMessages event for admin
  socket.on("getAllMessages", async () => {
    if (socket.handshake.query.userId === "admin") {
      const allMessages = await ChatMessage.find().sort("timestamp");
      const groupedMessages = allMessages.reduce((acc, message) => {
        if (!acc[message.userId]) {
          acc[message.userId] = [];
        }
        acc[message.userId].push(message);
        return acc;
      }, {});
      socket.emit("allMessages", groupedMessages); // Send all messages to the admin
    }
  });
});

// Endpoint for admin login
app.post("/auth/admin-login", (req, res) => {
  const { email, password } = req.body;

  // Log the login attempt and expected credentials
  console.log("Login attempt:", { email, password });
  console.log("Expected:", {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  // Check if the provided credentials match the admin credentials
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    console.log("Login successful");
    res.json({ success: true, token: "admin-token" }); // Return success response with a token
  } else {
    console.log("Login failed");
    res.status(401).json({ success: false, message: "Invalid credentials" }); 
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
