const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  let token = null;

  // 1. Extract token from HttpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } 
  // 2. Fallback: Extract from Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication token is missing',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'default_dev_jwt_secret_key_12345';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // Contains { id: user._id, googleId, email }
    next();
  } catch (error) {
    console.error('JWT Verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired authentication token',
    });
  }
};

module.exports = authMiddleware;
