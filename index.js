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
    origin: ["https://customer-chat-five.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: ["https://customer-chat-five.vercel.app", "http://localhost:5173"],
  credentials: true,
}));

app.options('*', cors());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json()); 

app.get('/', (req, res) => {
  res.send('Server is running.');
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const ChatMessage = mongoose.model("ChatMessage", {
  userId: String,
  message: String,
  isAdmin: Boolean,
  timestamp: Date,
});

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  socket.join(userId);

  socket.on("sendMessage", async (message) => {
    try {
      const chatMessage = new ChatMessage({
        userId,
        message,
        isAdmin: false,
        timestamp: new Date(),
      });
      await chatMessage.save();
      io.to(userId).emit("message", chatMessage);
      io.to("admin").emit("newMessage", chatMessage);
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("error", "Failed to save message");
    }
  });

  socket.on("adminReply", async ({ userId, message }) => {
    try {
      const chatMessage = new ChatMessage({
        userId,
        message,
        isAdmin: true,
        timestamp: new Date(),
      });
      await chatMessage.save();
      io.to(userId).emit("message", chatMessage);
      io.to("admin").emit("newMessage", chatMessage);
    } catch (error) {
      console.error("Error saving admin reply:", error);
      socket.emit("error", "Failed to save admin reply");
    }
  });

  socket.on("getHistory", async () => {
    try {
      const messages = await ChatMessage.find({ userId }).sort("timestamp");
      socket.emit("history", messages);
    } catch (error) {
      console.error("Error fetching history:", error);
      socket.emit("error", "Failed to fetch message history");
    }
  });

  socket.on("getAllMessages", async () => {
    if (socket.handshake.query.userId === "admin") {
      try {
        const allMessages = await ChatMessage.find().sort("timestamp");
        const groupedMessages = allMessages.reduce((acc, message) => {
          if (!acc[message.userId]) {
            acc[message.userId] = [];
          }
          acc[message.userId].push(message);
          return acc;
        }, {});
        socket.emit("allMessages", groupedMessages);
      } catch (error) {
        console.error("Error fetching all messages:", error);
        socket.emit("error", "Failed to fetch all messages");
      }
    }
  });
});

app.post("/auth/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: "admin-token" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));