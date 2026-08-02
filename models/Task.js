const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  taskType: {
    type: String,
    enum: ['borrow_book', 'return_book', 'reading_alert', 'general'],
    default: 'general',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  bookTitle: {
    type: String,
    trim: true,
    default: '',
  },
  author: {
    type: String,
    trim: true,
    default: '',
  },
  borrowerName: {
    type: String,
    trim: true,
    default: '',
  },
  pagesPerDay: {
    type: Number,
    default: 0,
  },
  startPage: {
    type: Number,
    default: 0,
  },
  endPage: {
    type: Number,
    default: 0,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  returnStatus: {
    type: String,
    enum: ['pending', 'due_soon', 'overdue', 'returned', 'completed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  dueDate: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Task', taskSchema);
