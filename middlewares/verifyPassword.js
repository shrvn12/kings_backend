const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");

const verifyPassword = async (req, res, next) => {
    const data = req.body;
    if (!data.userName && !data.email){
        return res.status(403).json({msg: 'Invalid input'});
    }
    const user = await userModel.find({"$or": [{email: data.email}, {userName: data.userName}]}).lean();

    if (!user || !user.length){
        return res.status(404).json({msg:'Account does not exist'});
    }

    req.user = user[0];

    return bcrypt.compare(data.password, user[0].password, (err, result) => {
        if (err){
            return res.status(500).json({msg: "Something went wrong"});
        }
        if (result){
            return next();
        } else {
            return res.status(401).json({msg: "password do not match"});
        }
    })
}

module.exports = verifyPassword