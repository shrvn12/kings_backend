const express = require('express');
const conversationModel = require('../models/conversation.model');
const verifyToken = require('../middlewares/verifyToken');
const userModel = require('../models/user.model');
const messageModel = require('../models/message.model');

const conversationRouter = express.Router();

// conversationRouter.get('/list', verifyToken, async (req, res) => {
//     const userId = req.user._id;
//     try {
//         const conversations = await conversationModel.find({
//             participants: userId
//         }).lean();

//         let users = await Promise.all(conversations.map(async (item) => {
//             const otherUserId = item.participants.find(
//                 (id) => id.toString() !== userId.toString()
//             );

//             if (otherUserId) {
//                 const user = await userModel.findById(otherUserId).lean();
//                 if (user) {
//                     return {
//                         ...user,
//                         conversationId: item._id  // 👈 Add conversationId to the user object
//                     };
//                 }
//             }
//         }))

//         return res.json({conversations, users});
//     } catch (error) {
//         console.log('error while fetching conversations', error);
//         res.status(500).send('something went wrong', error);
//     }
// })

conversationRouter.get('/list', verifyToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const conversations = await conversationModel
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .lean();

    const result = await Promise.all(
      conversations.map(async (conversation) => {

        // find other user
        const otherUserId = conversation.participants.find(
          id => id.toString() !== userId.toString()
        );
        if (!otherUserId) return null;

        const user = await userModel.findById(otherUserId).lean();
        if (!user) return null;

        // fetch last message (if exists)
        let lastMessage = null;
        if (conversation.lastMessage) {
          const msg = await messageModel.findById(conversation.lastMessage).lean();
          if (msg) {
            lastMessage = {
              _id: msg._id,
              text: msg.text,
              status: msg.status,
              senderId: msg.senderId,
              createdAt: msg.createdAt
            };
          }
        }

        return {
          conversationId: conversation._id,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
          },
          lastMessage,
          updatedAt: conversation.updatedAt
        };
      })
    );

    return res.json(result.filter(Boolean));

  } catch (error) {
    console.error('error while fetching conversations', error);
    res.status(500).json({ message: 'something went wrong' });
  }
});



conversationRouter.get('/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        if (!id){
            return res.status(403).json({msg:"Invalid parameter"});
        }
        const conv = await conversationModel.findById(id).lean();
        return res.json(conv);
    } catch (error) {
        console.log('Error while fetching conversation', error);
        res.status(500).json({msg: "Error while fetching conversation", error});
    }
})

conversationRouter.post('/create', verifyToken, async (req, res) => {
    const { participants, isGroup } = req.body;
    const userId = req.user._id;
    if (!participants || !Array.isArray(participants) || !participants.length) {
        return res.status(400).json({ msg: 'Invalid participants list.' });
    }
    if (isGroup && participants.length < 2) {
        return res.status(400).json({ msg: 'Group conversations require at least two participants.' });
    }
    try {
        const conversation = await conversationModel.create({
            participants: [userId, ...participants],
            isGroup,
            createdBy: userId
        });
        res.status(201).json({ msg: 'Conversation created', conversation });
    } catch (error) {
        console.log('Error while creating conversation', error);
        res.status(500).json({ msg: 'Error while creating conversation', error });
    }
});

module.exports = conversationRouter;