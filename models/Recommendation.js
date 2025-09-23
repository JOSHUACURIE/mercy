// models/Recommendation.js
const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  reason: { type: String, required: true },
  recommendedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  validFrom: { type: Date, required: true },
  validTo: { type: Date },
  badge: { 
    type: String, 
    enum: ['⭐ Top Performer', '🌟 Patient Favorite', '🏆 Most Improved'] 
  },
  isExpired: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
RecommendationSchema.index({ doctorId: 1 });
RecommendationSchema.index({ isExpired: 1 });

module.exports = mongoose.model('Recommendation', RecommendationSchema);