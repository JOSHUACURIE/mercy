const Recommendation = require('../models/Recommendation');
const User = require('../models/User');

// Create a new recommendation
exports.createRecommendation = async (req, res) => {
  const { doctorId, reason, badge, validFrom, validTo } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(400).json({ msg: 'Invalid doctor ID' });
    }

    const validBadges = ['⭐ Top Performer', '🌟 Patient Favorite', '🏆 Most Improved'];
    if (!validBadges.includes(badge)) {
      return res.status(400).json({ msg: 'Invalid badge. Use: ⭐ Top Performer, 🌟 Patient Favorite, 🏆 Most Improved' });
    }

    const fromDate = new Date(validFrom || Date.now());
    const toDate = validTo ? new Date(validTo) : null;

    const recommendation = new Recommendation({
      doctorId,
      reason,
      badge,
      recommendedBy: req.user.id,
      validFrom: fromDate,
      validTo: toDate,
      isExpired: false
    });

    await recommendation.save();

    // Populate doctorId and recommendedBy
    await recommendation.populate([
      { path: 'doctorId', select: 'name email' },
      { path: 'recommendedBy', select: 'name email' }
    ]);

    res.status(201).json({
      msg: `Dr. ${doctor.name} has been recommended successfully!`,
      recommendation
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get recommendations for a doctor
exports.getDoctorRecommendations = async (req, res) => {
  try {
    let doctorId;

    if (req.params.id) {
      doctorId = req.params.id;
      const targetDoctor = await User.findById(doctorId);
      if (!targetDoctor || targetDoctor.role !== 'doctor') {
        return res.status(400).json({ msg: 'Invalid doctor ID' });
      }

      if (req.user.role !== 'admin' && doctorId !== req.user.id) {
        return res.status(403).json({ msg: 'Not authorized' });
      }
    } else {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ msg: 'Only doctors can view their own recommendations' });
      }
      doctorId = req.user.id;
    }

    const now = new Date();
    const recommendations = await Recommendation.find({
      doctorId,
      isExpired: false,
      $or: [
        { validTo: { $exists: false } },
        { validTo: { $gte: now } }
      ]
    })
    .populate('recommendedBy', 'name')
    .sort({ validFrom: -1 });

    res.json(recommendations);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get recommendation by ID
exports.getRecommendationById = async (req, res) => {
  try {
    const recommendation = await Recommendation.findById(req.params.id)
      .populate('doctorId', 'name email')
      .populate('recommendedBy', 'name email');

    if (!recommendation) {
      return res.status(404).json({ msg: 'Recommendation not found' });
    }

    if (recommendation.validTo && recommendation.validTo < new Date()) {
      recommendation.isExpired = true;
      await recommendation.save();
      return res.status(400).json({ msg: 'This recommendation has expired' });
    }

    if (req.user.role !== 'admin' && recommendation.doctorId._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(recommendation);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get public recommendations
exports.getPublicRecommendations = async (req, res) => {
  try {
    const now = new Date();

    const recommendations = await Recommendation.find({
      isExpired: false,
      $or: [
        { validTo: { $exists: false } },
        { validTo: { $gte: now } }
      ]
    })
    .populate('doctorId', 'name email role')
    .populate('recommendedBy', 'name')
    .sort({ validFrom: -1 })
    .limit(10);

    const doctorMap = new Map();
    recommendations.forEach(rec => {
      if (!doctorMap.has(rec.doctorId._id.toString())) {
        doctorMap.set(rec.doctorId._id.toString(), {
          doctor: rec.doctorId,
          badges: [rec.badge],
          reasons: [rec.reason],
          recommendedBy: rec.recommendedBy.name
        });
      } else {
        const existing = doctorMap.get(rec.doctorId._id.toString());
        existing.badges.push(rec.badge);
        existing.reasons.push(rec.reason);
      }
    });

    const result = Array.from(doctorMap.values());
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Update a recommendation
exports.updateRecommendation = async (req, res) => {
  const { reason, badge, validTo, isExpired } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const recommendation = await Recommendation.findById(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ msg: 'Recommendation not found' });
    }

    if (reason) recommendation.reason = reason;
    if (badge) {
      const validBadges = ['⭐ Top Performer', '🌟 Patient Favorite', '🏆 Most Improved'];
      if (!validBadges.includes(badge)) {
        return res.status(400).json({ msg: 'Invalid badge' });
      }
      recommendation.badge = badge;
    }
    if (validTo) recommendation.validTo = new Date(validTo);
    if (isExpired !== undefined) recommendation.isExpired = isExpired;

    if (recommendation.validTo && recommendation.validTo < new Date()) {
      recommendation.isExpired = true;
    }

    await recommendation.save();

    await recommendation.populate('doctorId', 'name');

    res.json({
      msg: 'Recommendation updated successfully',
      recommendation
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get all recommendations (admin)
exports.getAllRecommendations = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { badge, doctorId, isExpired, validFrom, validTo } = req.query;
    let filter = {};

    if (badge) filter.badge = badge;
    if (doctorId) filter.doctorId = doctorId;
    if (isExpired !== undefined) filter.isExpired = isExpired === 'true';

    if (validFrom || validTo) {
      filter.validFrom = {};
      if (validFrom) filter.validFrom.$gte = new Date(validFrom);
      if (validTo) filter.validFrom.$lte = new Date(validTo);
    }

    const recommendations = await Recommendation.find(filter)
      .populate('doctorId', 'name email')
      .populate('recommendedBy', 'name email')
      .sort({ validFrom: -1 });

    res.json(recommendations);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// Get recommendation stats (admin)
exports.getRecommendationStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const totalActive = await Recommendation.countDocuments({ 
      isExpired: false,
      validTo: { $gte: new Date() } 
    });

    const byBadge = await Recommendation.aggregate([
      { $match: { isExpired: false } },
      { $group: { _id: "$badge", count: { $sum: 1 } } }
    ]);

    const mostRecommendedDoctors = await Recommendation.aggregate([
      { $match: { isExpired: false } },
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      { $unwind: '$doctor' },
      { $project: { _id: 0, doctorName: '$doctor.name', count: 1 } }
    ]);

    res.json({
      totalActive,
      byBadge,
      mostRecommendedDoctors
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};
