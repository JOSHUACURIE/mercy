// models/MedicalReport.js
const mongoose = require('mongoose');

const MedicalReportSchema = new mongoose.Schema({
  appointmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Appointment', 
    required: true 
  },
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  diagnosis: { type: String, required: true },
  prescriptions: [{
    medicine: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true }
  }],
  notes: { type: String },
  pdfUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
MedicalReportSchema.index({ patientId: 1 });
MedicalReportSchema.index({ doctorId: 1 });

module.exports = mongoose.model('MedicalReport', MedicalReportSchema);