// server/routes/duties.js
const express = require('express');
const router = express.Router();
const {
  assignDuty,
  getDoctorDuties,
  getDutyById,
  updateDuty,
  cancelDuty,
  getAllDuties,
  getDutyStats
} = require('../controllers/dutyController');
const { protect, isAdmin, isDoctor } = require('../middleware/auth');

// -------------------------
// CREATE (Admin only)
// -------------------------
router.post('/', protect, isAdmin, assignDuty);

// -------------------------
// DOCTOR ROUTES
// -------------------------
router.get('/doctor', protect, isDoctor, getDoctorDuties);

// -------------------------
// ADMIN ROUTES (before "/:id")
// -------------------------
router.get('/admin/stats', protect, isAdmin, getDutyStats);
router.get('/admin', protect, isAdmin, getAllDuties);

// -------------------------
// SINGLE DUTY (fallback last)
// -------------------------
router.get('/:id', protect, getDutyById);
router.put('/:id', protect, isAdmin, updateDuty);
router.delete('/:id', protect, isAdmin, cancelDuty);

module.exports = router;
