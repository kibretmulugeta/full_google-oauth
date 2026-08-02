const User = require('../models/User');

/**
 * RBAC Middleware: Enforces that the authenticated user has one of the allowed roles.
 * Usage: checkRole(['admin', 'superadmin'])
 */
const checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User not authenticated' });
      }

      // Fetch fresh user from DB if role is not fully in token
      const user = await User.findById(req.user.id).select('role permissions');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User account not found' });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]`,
        });
      }

      req.user.role = user.role;
      req.user.permissions = user.permissions;
      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      res.status(500).json({ success: false, message: 'Server error during role verification' });
    }
  };
};

/**
 * PBAC Middleware: Enforces that the authenticated user has a specific required permission.
 * Usage: checkPermission('manage:users')
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User not authenticated' });
      }

      const user = await User.findById(req.user.id).select('role permissions');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: User account not found' });
      }

      // Admins and superadmins bypass granular permission checks
      if (user.role === 'admin' || user.role === 'superadmin') {
        req.user.role = user.role;
        req.user.permissions = user.permissions;
        return next();
      }

      const hasPermission = user.permissions && user.permissions.includes(requiredPermission);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Missing required permission '${requiredPermission}'`,
        });
      }

      req.user.role = user.role;
      req.user.permissions = user.permissions;
      next();
    } catch (error) {
      console.error('PBAC Middleware Error:', error);
      res.status(500).json({ success: false, message: 'Server error during permission verification' });
    }
  };
};

module.exports = { checkRole, checkPermission };
