// server/routes/appointments.js
const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  getAllAppointments
} = require('../controllers/appointmentController');

const { protect, isAdmin, isDoctor, isPatient } = require('../middleware/auth');


router.get('/admin', protect, isAdmin, getAllAppointments);

router.get('/patient', protect, isPatient, getPatientAppointments);

// -------------------------
// Doctor: Get own appointments
// -------------------------
router.get('/doctor', protect, isDoctor, getDoctorAppointments);


router.post('/', protect, createAppointment);             // Any logged-in user can create (adjust if needed)
router.get('/:id', protect, getAppointmentById);          // Any logged-in user with access
router.put('/:id', protect, updateAppointment);           // Any logged-in user with access (adjust roles if needed)
router.delete('/:id', protect, cancelAppointment);        // Any logged-in user with access (adjust roles if needed)

module.exports = router;
