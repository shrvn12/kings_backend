const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const conversationSchema = new Schema({
  participants: [{ type: Types.ObjectId, ref: 'User' }],
  isGroup: { type: Boolean, default: false },
  name: { type: String },
  lastMessage: { type: Types.ObjectId, ref: 'Message' },
  createdBy: { type: Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // 👈 Automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('Conversation', conversationSchema);
