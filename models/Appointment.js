// server/models/Appointment.js
const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
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
  date: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled', 'no-show'], 
    default: 'scheduled' 
  },
  reason: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  notes: { 
    type: String,
    trim: true,
    maxlength: 500
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance
AppointmentSchema.index({ patientId: 1, status: 1 });
AppointmentSchema.index({ doctorId: 1, date: 1 });
AppointmentSchema.index({ status: 1, date: 1 });

// Pre-save middleware to validate doctor and patient roles
AppointmentSchema.pre('save', async function(next) {
  try {
    const User = mongoose.model('User');
    
    // Validate patient exists and is a patient
    const patient = await User.findById(this.patientId);
    if (!patient || patient.role !== 'patient') {
      throw new Error('Invalid patient ID or user is not a patient');
    }
    
    // Validate doctor exists and is a doctor
    const doctor = await User.findById(this.doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      throw new Error('Invalid doctor ID or user is not a doctor');
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

// Method to get appointment with populated data
AppointmentSchema.methods.getPopulatedData = async function() {
  return await this.populate([
    { path: 'patientId', select: 'name email phone' },
    { path: 'doctorId', select: 'name email specialty department' }
  ]);
};

module.exports = mongoose.model('Appointment', AppointmentSchema);