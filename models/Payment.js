// models/Payment.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  appointmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Appointment' 
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  invoiceNumber: { type: String, unique: true },
  paidAt: { type: Date },
  paymentMethod: { type: String, default: 'stripe' },
  receiptUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
PaymentSchema.index({ patientId: 1, status: 1 });
PaymentSchema.index({ invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Payment', PaymentSchema);