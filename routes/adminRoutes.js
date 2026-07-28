const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const User = require('../models/User');
const Task = require('../models/Task');

const router = express.Router();

// Apply authMiddleware and adminMiddleware to all admin endpoints
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard summary metrics for admin
 * @access  Private (Admin Only)
 */
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ completed: true });
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAdmins,
        totalTasks,
        completedTasks,
        pendingTasks,
        completionRate,
      },
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving admin statistics',
    });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get list of all registered users with task metrics
 * @access  Private (Admin Only)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-__v').sort({ createdAt: -1 });

    // Attach task count per user
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const userTaskCount = await Task.countDocuments({ userId: u._id });
        const userCompletedCount = await Task.countDocuments({ userId: u._id, completed: true });
        return {
          id: u._id,
          googleId: u.googleId,
          email: u.email,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          role: u.role || 'user',
          createdAt: u.createdAt,
          taskStats: {
            total: userTaskCount,
            completed: userCompletedCount,
          },
        };
      })
    );

    res.json({
      success: true,
      users: usersWithStats,
    });
  } catch (error) {
    console.error('Admin Fetch Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving users list',
    });
  }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Promote or demote a user role
 * @access  Private (Admin Only)
 */
router.put('/users/:id/role', async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Role must be either "user" or "admin"',
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Admin Role Update Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user role',
    });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user account and their tasks
 * @access  Private (Admin Only)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = req.params.id;

    // Prevent admin from deleting themselves
    if (targetUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account',
      });
    }

    const user = await User.findByIdAndDelete(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete associated tasks
    await Task.deleteMany({ userId: targetUserId });

    res.json({
      success: true,
      message: `User ${user.displayName} and associated tasks deleted`,
      userId: targetUserId,
    });
  } catch (error) {
    console.error('Admin User Delete Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user',
    });
  }
});

/**
 * @route   GET /api/admin/tasks
 * @desc    Get all tasks across all users in system
 * @access  Private (Admin Only)
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('userId', 'displayName email avatarUrl')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('Admin Fetch Tasks Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving system tasks',
    });
  }
});

module.exports = router;
