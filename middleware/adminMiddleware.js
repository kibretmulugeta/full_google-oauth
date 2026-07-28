const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required',
      });
    }

    // Double check user role from DB if needed or use token role
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Admin privileges required',
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying admin privileges',
    });
  }
};

module.exports = adminMiddleware;
