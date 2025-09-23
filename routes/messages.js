// server/routes/messages.js
const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getSentMessages,
  getMessageById,
  getAllMessages,
  updateMessage,
  archiveMessage,
  getMessageStats
} = require('../controllers/messageController');
const{protect,isDoctor,isAdmin,isPatient}=require('../middleware/auth')

// @route   POST /api/messages → Doctor sends to admin
router.post('/',protect, isDoctor, sendMessage);

// @route   GET /api/messages/sent → Doctor views sent messages
router.get('/sent',protect,isDoctor, getSentMessages);

// @route   GET /api/messages/:id → Get single message
router.get('/:id', protect, getMessageById);

// @route   PUT /api/messages/:id → Admin updates (mark read/resolved)
router.put('/:id',protect,isAdmin, updateMessage);

// @route   DELETE /api/messages/:id → Archive message
router.delete('/:id', protect,isAdmin, archiveMessage);

// @route   GET /api/messages/admin → Admin inbox (with filters)
router.get('/admin',protect,isAdmin, getAllMessages);

// @route   GET /api/messages/admin/stats → Admin stats
router.get('/admin/stats', protect,isAdmin, getMessageStats);

module.exports = router;