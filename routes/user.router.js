const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const userModel = require('../models/user.model');
const conversationModel = require('../models/conversation.model');
const userRouter = express.Router();

userRouter.get('/userInfo', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const userData = await userModel.findById(userId).lean();
        delete userData.password;
        if (!userData) {
            return res.status(404).send({msg: "User not found"});
        }
        res.json(userData);
    } catch (error) {
        console.log('Error while fetching user', error);
        res.status(500).json({msg: "Something went wrong"});
    }
})

userRouter.get('/search', verifyToken, async (req, res) => {
    const userName = req.query.userName;
    if (!userName){
        return res.status('403').json({msg: 'Invalid query'});
    }
    const user = await userModel.findOne({userName});
    return res.json(user);
})

userRouter.get('/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        if (!id){
            return res.status(403).json({msg:"Invalid parameter"});
        }
        const user = await userModel.findById(id).lean();
        if (!user) {
            return res.status(404).json({msg: "User not found"});
        }
        // find conversationId by checking participants array in conversationModel
        const conversation = await conversationModel.findOne({
            isGroup: false,
            participants: { $all: [req.user._id, id], $size: 2 }
        }).lean();
        if (conversation) {
            user.conversationId = conversation._id;
        }
        delete user.password;
        return res.json(user);
    } catch (error) {
        console.log('Error while fetching user', error);
        res.status(500).json({msg: "Error while fetching user", error});
    }
});

module.exports = userRouter;