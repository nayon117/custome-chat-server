const express = require('express');
const Message = require('../../models/Message');
const router = express.Router();

// Create a new message
router.post('/', async (req, res) => {
    const message = new Message(req.body);
    try {
      await message.save();
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  
// Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
