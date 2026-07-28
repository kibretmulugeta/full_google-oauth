const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Task = require('../models/Task');

const router = express.Router();

// Apply authMiddleware to all task endpoints
router.use(authMiddleware);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for authenticated user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { completed, priority } = req.query;
    const filter = { userId: req.user.id };

    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    if (priority) {
      filter.priority = priority;
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    const totalCount = await Task.countDocuments({ userId: req.user.id });
    const completedCount = await Task.countDocuments({ userId: req.user.id, completed: true });

    res.json({
      success: true,
      tasks,
      stats: {
        total: totalCount,
        completed: completedCount,
        pending: totalCount - completedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tasks',
    });
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task for authenticated user
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required',
      });
    }

    const newTask = await Task.create({
      userId: req.user.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority && ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: newTask,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating task',
    });
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task details or toggle completed status
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, completed, priority, dueDate } = req.body;

    let task = await Task.findOne({ _id: taskId, userId: req.user.id });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or unauthorized',
      });
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (completed !== undefined) task.completed = Boolean(completed);
    if (priority !== undefined && ['low', 'medium', 'high'].includes(priority)) {
      task.priority = priority;
    }
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;

    await task.save();

    res.json({
      success: true,
      message: 'Task updated successfully',
      task,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating task',
    });
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;

    const task = await Task.findOneAndDelete({ _id: taskId, userId: req.user.id });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or unauthorized',
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully',
      taskId,
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting task',
    });
  }
});

module.exports = router;
