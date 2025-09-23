// server/routes/payments.js
const express = require('express');
const router = express.Router();
const {
  getPatientPayments,
  getPaymentById,
  payBill,
  getAllPayments,
  updatePayment,
  getPaymentStats,
  generateReceipt
} = require('../controllers/paymentController');
const { protect, isAdmin, isPatient } = require('../middleware/auth');

// -------------------------
// PATIENT ROUTES
// -------------------------
router.get('/', protect, isPatient, getPatientPayments);      // Patient views their bills
router.put('/:id/pay', protect, isPatient, payBill);          // Patient pays bill
router.get('/:id/receipt', protect, isPatient, generateReceipt); // Patient downloads receipt

// -------------------------
// ADMIN ROUTES (before "/:id")
// -------------------------
router.get('/admin/stats', protect, isAdmin, getPaymentStats);
router.get('/admin', protect, isAdmin, getAllPayments);
router.put('/:id', protect, isAdmin, updatePayment);          // Admin updates payment

// -------------------------
// FALLBACK: SINGLE PAYMENT
// -------------------------
router.get('/:id', protect, getPaymentById);

module.exports = router;
