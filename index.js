const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const connection = require('./configs/db');
const authRouter = require('./routes/auth.router');
const userModel = require('./models/user.model');
const messageRouter = require('./routes/message.router');
const mongoose = require('mongoose');
const conversationModel = require('./models/conversation.model');
const messageModel = require('./models/message.model');
const conversationRouter = require('./routes/conversation.router');
const userRouter = require('./routes/user.router');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // Allow all origins for testing; restrict in production
        methods: ['GET', 'POST'],
        credentials: true
    },
});

// Store connected users: { username: socket.id }
const users = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.use('/auth', authRouter);
app.use('/user', userRouter);
app.use('/message', messageRouter);
app.use('/conv', conversationRouter);

const connectedUsers = new Map();
const onlineUsers = new Set();
const awayUsers = new Set();

io.use(require('./middlewares/socketAuth.middleware'));
io.on('connection', (socket) => {

    socket.on('join', async (user) => {
        const userId = user?._id;
        if (!userId) return;

        // register online user
        connectedUsers.set(userId.toString(), socket.id);
        console.log('User connected:', userId);
        console.log('Online users:', connectedUsers);
        updateStatus(socket.userId, 'online', io);
        try {
            // 1️⃣ find messages that should be marked delivered
            const messages = await messageModel.find({
                recipientId: new mongoose.Types.ObjectId(userId),
                status: 'sent'
            });

            if (!messages.length) return;

            const messageIds = messages.map(m => m._id);

            // 2️⃣ update DB
            await messageModel.updateMany(
                { _id: { $in: messageIds } },
                {
                    $set: {
                        status: 'delivered',
                        deliveredAt: new Date()
                    }
                }
            );

            // 3️⃣ group message IDs by sender
            const receiptsBySender = new Map();

            for (const msg of messages) {
                const senderId = msg.senderId.toString();
                if (!receiptsBySender.has(senderId)) {
                    receiptsBySender.set(senderId, []);
                }
                receiptsBySender.get(senderId).push(msg._id);
            }

            // 4️⃣ emit receipt to each sender (if online)
            for (const [senderId, msgIds] of receiptsBySender.entries()) {
                const senderSocketId = connectedUsers.get(senderId);
                if (!senderSocketId) continue;

                io.to(senderSocketId).emit('message-receipt', {
                    messageId: msgIds,       // ✅ ARRAY
                    status: 'delivered',
                });
            }

            console.log('Delivery receipts sent');

        } catch (err) {
            console.error('Error marking messages as delivered:', err);
        }
    });

    socket.on('private message', async (message) => {
        try {
            const { conversationId, clientMessageId, text, type } = message;

            console.log('Private message received:', message);

            const senderId = socket.userId;

            // ✅ Validate conversation ID

            if (!mongoose.Types.ObjectId.isValid(conversationId)) {
                return socket.emit('error', 'Invalid conversation ID');
            }

            const conversation = await conversationModel.findById(conversationId);
            if (!conversation) return;

            // ✅ Find recipient
            const recipientId = conversation.participants.find(
                (id) => id.toString() !== senderId
            );

            const recipientSocketId = connectedUsers.get(recipientId.toString());

            // ✅ Save message (default: sent)
            const savedMessage = await messageModel.create({
                conversationId,
                senderId,
                recipientId,
                text,
                type: type || 'text',
                status: 'sent'
            });

            // ✅ Update conversation
            await conversationModel.findByIdAndUpdate(conversationId, {
                lastMessage: savedMessage._id,
                updatedAt: new Date()
            });

            // ✅ If recipient is online → deliver
            if (recipientSocketId) {
                // Send message to recipient
                io.to(recipientSocketId).emit('private message', savedMessage);

                // ✅ Update status → delivered
                await messageModel.findByIdAndUpdate(savedMessage._id, {
                    status: 'delivered',
                    deliveredAt: new Date()
                });
                // ✅ Send delivery receipt to sender
                io.to(socket.id).emit('message-receipt', {
                    clientMessageId,
                    savedMessageId: savedMessage._id,
                    status: 'delivered',
                    conversationId
                });
            } else {
                // Recipient offline, just confirm sent status
                io.to(socket.id).emit('message-receipt', {
                    clientMessageId,
                    savedMessageId: savedMessage._id,
                    conversationId
                });
            }

        } catch (err) {
            console.error('Socket error:', err);
            socket.emit('error', 'Failed to send message');
        }
    });

    socket.on('mark-read', async ({ conversationId }) => {
        try {
            const userId = socket.userId; // from auth middleware
            console.log('Mark read for conversation:', conversationId, 'by user:', userId, typeof userId);
            // update only unread messages NOT sent by this user
            const result = await messageModel.updateMany(
                {
                    conversationId: new mongoose.Types.ObjectId(conversationId),
                    recipientId: new mongoose.Types.ObjectId(userId), // Mongoose auto-casts strings to ObjectIds
                    status: { $ne: 'read' }
                },
                {
                    $set: {
                        status: 'read',
                        readAt: new Date()
                    }
                }
            );

            console.log('Messages marked as read:', result);

            // notify sender(s)
            const conversation = await conversationModel.findById(conversationId);

            conversation.participants.forEach((participantId) => {
                if (participantId.toString() !== userId.toString()) {
                    const senderSocketId = connectedUsers.get(participantId.toString());
                    if (senderSocketId) {
                        io.to(senderSocketId).emit('message-receipt', {
                            conversationId,
                            status: 'read'
                        });
                    }
                }
            });

        } catch (err) {
            console.error('Read receipt error:', err);
        }
    });

    socket.on('status:get', ({ userId }) => {
        onlineUsers.add(socket.userId);
        awayUsers.delete(socket.userId);
        const isOnline = onlineUsers.has(userId);
        const isAway = awayUsers.has(userId);
        let state = 'offline';
        if (isOnline) {
            state = 'online';
        } else if (isAway) {
            state = 'away';
        }
        socket.emit('user-status', {
            userId,
            state   // 'online' | 'away' | 'offline'
        });
    });

    socket.on('status:update', async ({ state }) => {
        console.log('Status update received:', state);
        const userId = socket.userId;
        if (!userId) return;

        updateStatus(userId, state, io);

    });


    // Handle user disconnection
    socket.on('disconnect', () => {
        connectedUsers.forEach((value, key) => {
            if (value === socket.id) {
                connectedUsers.delete(key);
            }
        });
        console.log('User disconnected');
        updateStatus(socket.userId, 'offline', io);
    });
});

updateStatus = async (userId, state, io) => {
    if (!userId) return;
    if (state === 'online') {
        onlineUsers.add(userId);
    } else if (state === 'away') {
        awayUsers.add(userId);
    } else {
        onlineUsers.delete(userId);
        awayUsers.delete(userId);
    }
    try {
        // 1️⃣ Find conversations involving this user
        const conversations = await conversationModel.find({
            participants: userId
        }).lean();

        if (!conversations.length) return;

        // 2️⃣ Collect unique conversation partners
        const partnerIds = new Set();

        for (const conv of conversations) {
            const partnerId = conv.participants.find(
                id => id.toString() !== userId.toString()
            );
            if (partnerId) {
                partnerIds.add(partnerId.toString());
            }
        }

        // 3️⃣ Notify only online partners
        for (const partnerId of partnerIds) {
            const partnerSocketId = connectedUsers.get(partnerId);
            if (!partnerSocketId) continue;

            io.to(partnerSocketId).emit('user-status', {
                userId,
                state   // 'online' | 'away'
            });
        }

        console.log(`Status update sent: ${userId} → ${state}`);

    } catch (err) {
        console.error('Error handling status update:', err);
    }
};

server.listen(process.env.PORT, () => {
    try {
        connection;
        console.log('Successfully connected to db');
    } catch (error) {
        console.log('Error while connecting to db');
        console.log(error);

    }
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});
