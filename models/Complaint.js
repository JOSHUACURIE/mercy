// server/models/Complaint.js
const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['complaint', 'suggestion'], 
    required: true 
  },
  category: { 
    type: String, 
    enum: ['billing', 'service', 'facility', 'staff', 'other'],
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000
  },
  status: { 
    type: String, 
    enum: ['received', 'reviewing', 'resolved', 'rejected'], 
    default: 'received' 
  },
  resolvedAt: {
    type: Date
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance
ComplaintSchema.index({ userId: 1, status: 1 });
ComplaintSchema.index({ status: 1, category: 1 });
ComplaintSchema.index({ type: 1, category: 1 });

// Pre-save middleware to validate user exists
ComplaintSchema.pre('save', async function(next) {
  try {
    const User = mongoose.model('User');
    const user = await User.findById(this.userId);
    if (!user) {
      throw new Error('Invalid user ID');
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Method to get complaint with populated user data
ComplaintSchema.methods.getPopulatedData = async function() {
  return await this.populate('userId', 'name email role');
};

// Static method to get complaint stats
ComplaintSchema.statics.getStats = async function() {
  const [total, byStatus, byType, byCategory] = await Promise.all([
    this.countDocuments({ isArchived: false }),
    this.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ])
  ]);

  return {
    total,
    byStatus,
    byType,
    byCategory
  };
};

module.exports = mongoose.model('Complaint', ComplaintSchema);