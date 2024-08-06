
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const ChatMessage = mongoose.model('ChatMessage', {
  userId: String,
  message: String,
  isAdmin: Boolean,
  timestamp: Date
});

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;

  socket.join(userId);

  socket.on('sendMessage', async (message) => {
    const chatMessage = new ChatMessage({
      userId,
      message,
      isAdmin: false,
      timestamp: new Date()
    });
    await chatMessage.save();
    io.to(userId).emit('message', chatMessage);
    io.to('admin').emit('newMessage', chatMessage);
  });

  socket.on('adminReply', async ({ userId, message }) => {
    const chatMessage = new ChatMessage({
      userId,
      message,
      isAdmin: true,
      timestamp: new Date()
    });
    await chatMessage.save();
    io.to(userId).emit('message', chatMessage);
  });

  socket.on('getHistory', async () => {
    const messages = await ChatMessage.find({ userId }).sort('timestamp');
    socket.emit('history', messages);
  });
});

app.post('/auth/admin-login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password }); 
  console.log('Expected:', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    console.log('Login successful');
    res.json({ success: true, token: 'admin-token' });
  } else {
    console.log('Login failed'); 
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));