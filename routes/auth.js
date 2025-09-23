
const express = require('express');
const router = express.Router();
const {
  registerPatient,
  registerDoctor,
  login,
  getMe,
  updateProfile,
  changePassword,
  getDoctors,
  getPatients,
  toggleUserStatus,
  logout,
  getAllDoctorsForPatients
} = require('../controllers/authController');

const { protect, isAdmin } = require('../middleware/auth');

// ---------------------
// Public routes
// ---------------------
router.post('/register-patient', registerPatient); 
router.post('/register-doctor', registerDoctor);   
router.post('/login', login);
router.post('/logout', logout);

// Verify token and return role
router.get('/verify', protect, (req, res) => {
  res.json({
    id: req.user._id,
    role: req.user.role,
    name: req.user.name,
  });
});
router.get('/doctors', protect, getAllDoctorsForPatients);
// ---------------------
// Private routes (all roles)
// ---------------------
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// ---------------------
// Admin-only routes
// ---------------------

// ✅ Unified users route: /api/auth/admin/users?role=doctor OR patient
router.get('/admin/users', protect, isAdmin, async (req, res) => {
  const { role } = req.query;
  try {
    if (!role) {
      return res.status(400).json({ msg: 'Role query is required' });
    }

    if (role === 'doctor') {
      const doctors = await getDoctors(req, res);
      return doctors;
    }

    if (role === 'patient') {
      const patients = await getPatients(req, res);
      return patients;
    }

    return res.status(400).json({ msg: 'Invalid role type' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Keep old ones if needed (but mark them as deprecated)
router.get('/admin/patients', protect, isAdmin, getPatients);
router.get('/admin/doctors', protect, isAdmin, getDoctors);

// ✅ Toggle status (block/unblock user)
router.put('/admin/users/:id/toggle', protect, isAdmin, toggleUserStatus);

module.exports = router;
