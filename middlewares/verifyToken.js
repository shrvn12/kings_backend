const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function verifyTokenFromCookie(req, res, next) {
  const token = req.cookies?.token || req.headers.token;
  if (!token) {
    console.log('returned');
    return res.status(401).json({ msg: 'Access denied.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ msg: 'Invalid or expired token.' });
  }
};
