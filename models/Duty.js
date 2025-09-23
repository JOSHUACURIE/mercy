
const mongoose = require('mongoose');

const DutySchema = new mongoose.Schema({
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  department: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  notes: { type: String },
  assignedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'cancelled', 'completed'], 
    default: 'active' 
  },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
DutySchema.index({ doctorId: 1, status: 1 });

module.exports = mongoose.model('Duty', DutySchema);