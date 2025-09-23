// server/routes/complaints.js
const express = require('express');
const router = express.Router();
const {
  submitComplaint,
  getMyComplaints,
  getComplaintById,
  getAllComplaints,
  updateComplaint,
  archiveComplaint,
  getComplaintStats
} = require('../controllers/complaintController');
const { protect, isAdmin } = require('../middleware/auth');

// -------------------------
// CREATE
// -------------------------
router.post('/', protect, submitComplaint);

// -------------------------
// USER ROUTES
// -------------------------
router.get('/my', protect, getMyComplaints);

// -------------------------
// ADMIN ROUTES (must be BEFORE "/:id")
// -------------------------
router.get('/admin/stats', protect, isAdmin, getComplaintStats);
router.get('/admin', protect, isAdmin, getAllComplaints);

// -------------------------
// SINGLE COMPLAINT (fallback last)
// -------------------------
router.get('/:id', protect, getComplaintById);
router.put('/:id', protect, updateComplaint);
router.delete('/:id', protect, archiveComplaint);

module.exports = router;
