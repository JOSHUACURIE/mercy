
const Complaint = require('../models/Complaint');
const User = require('../models/User');


exports.submitComplaint = async (req, res) => {
  const { type, category, title, description } = req.body;

  try {
   
    if (!['complaint', 'suggestion'].includes(type)) {
      return res.status(400).json({ msg: 'Invalid type. Use "complaint" or "suggestion".' });
    }

   
    const validCategories = ['billing', 'service', 'facility', 'staff', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ msg: 'Invalid category' });
    }

    const complaint = new Complaint({
      userId: req.user.id,
      type,
      category: category || 'other',
      title,
      description,
      status: 'received'
    });

    await complaint.save();

    
    await complaint.populate('userId', 'name email role').execPopulate();

    res.status(201).json({
      msg: 'Thank you for your feedback. We’ll review it shortly.',
      complaint
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ 
      userId: req.user.id, 
      isArchived: false 
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json(complaints);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId', 'name email role');

    if (!complaint || complaint.isArchived) {
      return res.status(404).json({ msg: 'Complaint not found' });
    }

    
    if (req.user.role !== 'admin' && complaint.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(complaint);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllComplaints = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, type, category, userId } = req.query;
    let filter = { isArchived: false };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (userId) filter.userId = userId;

    const complaints = await Complaint.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });

    res.json(complaints);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updateComplaint = async (req, res) => {
  const { status, adminNotes } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint || complaint.isArchived) {
      return res.status(404).json({ msg: 'Complaint not found' });
    }

    if (status) {
      const validStatuses = ['received', 'reviewing', 'resolved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      complaint.status = status;
      if (status === 'resolved') {
        complaint.resolvedAt = Date.now();
      }
    }

    if (adminNotes) {
      complaint.adminNotes = adminNotes;
    }

    await complaint.save();


    await complaint.populate('userId', 'name email role').execPopulate();

    res.json({
      msg: 'Complaint updated successfully',
      complaint
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.archiveComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ msg: 'Complaint not found' });
    }

 
    if (req.user.role !== 'admin' && complaint.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    complaint.isArchived = true;
    await complaint.save();

    res.json({ msg: 'Complaint archived successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getComplaintStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const total = await Complaint.countDocuments({ isArchived: false });
    const byStatus = await Complaint.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const byType = await Complaint.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);
    const byCategory = await Complaint.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      byStatus,
      byType,
      byCategory
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};