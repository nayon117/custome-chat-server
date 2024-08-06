const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: String, enum: ['user', 'admin'], required: true },
  userId: { type: String, required: true },
}, {
  timestamps: true,
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
