// server/routes/recommendations.js
const express = require('express');
const router = express.Router();
const {
  createRecommendation,
  getDoctorRecommendations,
  getRecommendationById,
  getPublicRecommendations,
  updateRecommendation,
  getAllRecommendations,
  getRecommendationStats
} = require('../controllers/recommendationController');
const { protect, isAdmin, isDoctor } = require('../middleware/auth');

// -------------------------
// CREATE (Admin only)
// -------------------------
router.post('/', protect, isAdmin, createRecommendation);

// -------------------------
// DOCTOR ROUTES
// -------------------------
router.get('/my', protect, isDoctor, getDoctorRecommendations);
router.get('/doctor/:id', protect, getDoctorRecommendations);

// -------------------------
// ADMIN ROUTES (place BEFORE "/:id")
// -------------------------
router.get('/admin/stats', protect, isAdmin, getRecommendationStats);
router.get('/admin', protect, isAdmin, getAllRecommendations);

// -------------------------
// PUBLIC ROUTES
// -------------------------
router.get('/public', getPublicRecommendations);

// -------------------------
// SINGLE RECOMMENDATION (fallback last)
// -------------------------
router.get('/:id', protect, getRecommendationById);
router.put('/:id', protect, isAdmin, updateRecommendation);

module.exports = router;
