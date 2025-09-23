// server/routes/reports.js
const express = require('express');
const router = express.Router();
const {
  createReport,
  getPatientReports,
  getDoctorReports,
  getReportById,
  downloadReportPDF,
  getAllReports,
  getReportStats,
  updateReport,
} = require('../controllers/reportController');

const { protect, isDoctor, isPatient, isAdmin } = require('../middleware/auth');

// -------------------------
// CREATE (Doctor only)
// -------------------------
router.post('/', protect, isDoctor, createReport);

// -------------------------
// GET BY ROLE
// -------------------------
router.get('/patient', protect, isPatient, getPatientReports); // Only the patient can see their own reports
router.get('/doctor', protect, isDoctor, getDoctorReports);    // Only the doctor can see their reports
router.get('/admin', protect, isAdmin, getAllReports);         // Only admin sees all
router.get('/admin/stats', protect, isAdmin, getReportStats);  // Admin stats only

// -------------------------
// REPORT-SPECIFIC
// -------------------------
router.get('/:id/pdf', protect, downloadReportPDF); // any logged-in user with access
router.get('/:id', protect, getReportById);         // any logged-in user with access
router.put('/:id', protect, isDoctor, updateReport);// only doctor can update

module.exports = router;
