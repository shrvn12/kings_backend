// models/message.model.js

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const messageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    type: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
    deletedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true } // ✅ adds createdAt and updatedAt
);

const messageModel = mongoose.model('Message', messageSchema);
module.exports = messageModel;
