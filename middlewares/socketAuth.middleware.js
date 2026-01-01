const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function verifySocketToken(socket, next) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    if (!cookieHeader) {
      return next(new Error('Access denied'));
    }

    // parse cookies manually
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('='))
    );

    const token = cookies.token;

    if (!token) {
      return next(new Error('Access denied'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // attach user to socket (like req.user)
    socket.user = decoded;
    socket.userId = decoded._id;

    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};
