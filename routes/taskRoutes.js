const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Task = require('../models/Task');

const router = express.Router();

// Apply authMiddleware to all task endpoints
router.use(authMiddleware);

// Helper function to calculate return/due status
function computeReturnStatus(task) {
  if (task.completed) return 'completed';
  if (task.returnStatus === 'returned') return 'returned';
  if (!task.dueDate) return 'pending';

  const now = new Date();
  const due = new Date(task.dueDate);
  const diffHours = (due - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'overdue';
  if (diffHours <= 72) return 'due_soon';
  return 'pending';
}

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks/reminders for authenticated user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { completed, taskType, priority } = req.query;
    const filter = { userId: req.user.id };

    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    if (taskType) {
      filter.taskType = taskType;
    }
    if (priority) {
      filter.priority = priority;
    }

    let tasks = await Task.find(filter).sort({ createdAt: -1 });

    // Dynamic return status computation
    tasks = tasks.map((t) => {
      const obj = t.toObject();
      obj.computedStatus = computeReturnStatus(t);
      return obj;
    });

    const totalCount = await Task.countDocuments({ userId: req.user.id });
    const completedCount = await Task.countDocuments({ userId: req.user.id, completed: true });
    const overdueCount = tasks.filter((t) => t.computedStatus === 'overdue').length;

    res.json({
      success: true,
      tasks,
      stats: {
        total: totalCount,
        completed: completedCount,
        pending: totalCount - completedCount,
        overdue: overdueCount,
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
 * @desc    Create a new appointment / meeting / schedule event / reminder
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      taskType,
      title,
      description,
      location,
      clientName,
      durationMinutes,
      scheduleTopic,
      bookTitle,
      author,
      borrowerName,
      pagesPerDay,
      startPage,
      endPage,
      priority,
      dueDate,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    const validTypes = ['appointment', 'meeting', 'event', 'deadline', 'borrow_book', 'return_book', 'reading_alert', 'general'];
    const type = validTypes.includes(taskType) ? taskType : 'appointment';

    const newTask = await Task.create({
      userId: req.user.id,
      taskType: type,
      title: title.trim(),
      description: description ? description.trim() : '',
      location: location ? location.trim() : '',
      clientName: clientName ? clientName.trim() : '',
      durationMinutes: Number(durationMinutes) || 30,
      scheduleTopic: scheduleTopic ? scheduleTopic.trim() : '',
      bookTitle: bookTitle ? bookTitle.trim() : '',
      author: author ? author.trim() : '',
      borrowerName: borrowerName ? borrowerName.trim() : '',
      pagesPerDay: Number(pagesPerDay) || 0,
      startPage: Number(startPage) || 0,
      endPage: Number(endPage) || 0,
      priority: priority && ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    const taskObj = newTask.toObject();
    taskObj.computedStatus = computeReturnStatus(newTask);

    res.status(201).json({
      success: true,
      message: 'Schedule event created successfully',
      task: taskObj,
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
 * @route   POST /api/tasks/:id/extend
 * @desc    Reschedule appointment / extend due date by specified days (default 7 days)
 * @access  Private
 */
router.post('/:id/extend', async (req, res) => {
  try {
    const taskId = req.params.id;
    const days = Number(req.query.days) || 7;

    const task = await Task.findOne({ _id: taskId, userId: req.user.id });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Schedule record not found',
      });
    }

    const currentDue = task.dueDate ? new Date(task.dueDate) : new Date();
    currentDue.setDate(currentDue.getDate() + days);
    task.dueDate = currentDue;
    task.returnStatus = 'pending';
    await task.save();

    const taskObj = task.toObject();
    taskObj.computedStatus = computeReturnStatus(task);

    res.json({
      success: true,
      message: `Rescheduled appointment by +${days} days`,
      task: taskObj,
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rescheduling appointment',
    });
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task details or toggle completed/returned status
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, completed, returnStatus, priority, dueDate } = req.body;

    let task = await Task.findOne({ _id: taskId, userId: req.user.id });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or unauthorized',
      });
    }

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (completed !== undefined) {
      task.completed = Boolean(completed);
      if (completed) task.returnStatus = 'completed';
    }
    if (returnStatus !== undefined) task.returnStatus = returnStatus;
    if (priority !== undefined && ['low', 'medium', 'high'].includes(priority)) {
      task.priority = priority;
    }
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;

    await task.save();

    const taskObj = task.toObject();
    taskObj.computedStatus = computeReturnStatus(task);

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: taskObj,
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
