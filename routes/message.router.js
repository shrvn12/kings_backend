// routes/message.routes.js

const express = require('express');
const messageRouter = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');

messageRouter.post('/save', async (req, res) => {
  const { conversationId, text, type } = req.body;
  const senderId = req.body.senderId; 
  const receiverId = req.body.receiverId;

  if (!senderId || !receiverId || !text) {
    return res.status(400).json({ msg: 'Missing required fields.' });
  }

  try {
    let conversation;

    // 🧠 Step 1: Use existing conversation if valid ID is provided
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId);
    }

    // 🧪 Step 2: Create a new 1-to-1 conversation if not found
    if (!conversation) {
      conversation = await Conversation.findOne({
        isGroup: false,
        participants: { $all: [senderId, receiverId], $size: 2 }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, receiverId],
          isGroup: false,
          createdBy: senderId
        });
      }
    }

    // 💬 Step 3: Create the message
    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      type: type || 'text'
    });

    // 🔄 Step 4: Update last message reference
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id
    });

    res.status(201).json({ msg: 'Message saved', message, conversationId: conversation._id });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

messageRouter.get('/conversation/:id', async (req, res) => {
  const conversationId = req.params.id;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ msg: 'Invalid conversation ID.' });
  }
  try {
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = messageRouter;
