const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const validateFields = require("../middlewares/validator");
const verifyPassword = require('../middlewares/verifyPassword');
const verifyToken = require('../middlewares/verifyToken');
require('dotenv').config();

const authRouter = express.Router();
const salt = process.env.salt;

authRouter.get('/', (req, res) => {
    res.send('Auth router');
})

authRouter.get('/userInfo', verifyToken, async (req, res) => {
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

authRouter.post('/register', validateFields(["name", "email", "userName", "password"]), async (req, res) => {
    try {
        const data = req.body;

        const email = data.email.trim().toLowerCase();
        const userName = data.userName.trim().toLowerCase();

        const userExists = await userModel.findOne({
            $or: [
                { email },
                { userName }
            ]
        }).lean();

        if (userExists) {
            return res.status(409).json({ msg: 'User already exists' });
        }

        const payload = {
            name: data.name.trim(),
            email,
            userName,
            password:  bcrypt.hashSync(data.password, +salt)
        };

        const user = new userModel(payload);
        await user.save();
        return res.json({ msg: 'Registration successful' });
    } catch (error) {
        console.log('error while registration', error);
        res.status(500).send({ msg: 'error while registration', error });
    }
})

authRouter.post('/login', validateFields(["password"]), verifyPassword, async(req, res) => {
    try {
        const user = req.user;
        delete req.password;
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.clearCookie('user');
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.status(200).send({msg: 'login successful', token});
    } catch (error) {
        console.log('error while login', error);
        res.status(500).json({msg: "error while login", error});
    }
})

authRouter.post('/logout', verifyToken, (req, res) => {
    try {
        res.clearCookie('token');
        res.status(200).json({ msg: 'logout successful', success: true });
    } catch (error) {
        console.log('error while logout', error);
        res.status(500).json({ msg: 'error while logout', error });
    }
})

module.exports = authRouter;