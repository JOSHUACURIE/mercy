
const Duty = require('../models/Duty');
const User = require('../models/User');


exports.assignDuty = async (req, res) => {
  const { doctorId, department, startDate, endDate, notes } = req.body;

  try {
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(400).json({ msg: 'Invalid doctor ID or user is not a doctor' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ msg: 'End date must be after start date' });
    }

    const duty = new Duty({
      doctorId,
      department,
      startDate: start,
      endDate: end,
      notes: notes || '',
      assignedBy: req.user.id,
      status: 'active'
    });

    await duty.save();

    // ✅ populate without execPopulate
    await duty.populate('doctorId', 'name email');
    await duty.populate('assignedBy', 'name email');

    res.status(201).json({
      msg: `Duty assigned to Dr. ${doctor.name} successfully`,
      duty
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getDoctorDuties = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Access denied. Doctors only.' });
    }

    const { range = 'upcoming' } = req.query;
    let filter = { 
      doctorId: req.user.id, 
      status: 'active' 
    };

    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.setHours(0, 0, 0, 0));
      const end = new Date(now.setHours(23, 59, 59, 999));
      filter.startDate = { $lte: end };
      filter.endDate = { $gte: start };
    } else if (range === 'week') {
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      filter.startDate = { $lte: weekEnd };
      filter.endDate = { $gte: weekStart };
    } else if (range === 'upcoming') {
      filter.startDate = { $gte: now };
    }

    const duties = await Duty.find(filter)
      .populate('assignedBy', 'name')
      .sort({ startDate: 1 });

    res.json(duties);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getDutyById = async (req, res) => {
  try {
    const duty = await Duty.findById(req.params.id)
      .populate('doctorId', 'name email')
      .populate('assignedBy', 'name email');

    if (!duty) {
      return res.status(404).json({ msg: 'Duty not found' });
    }

   
    if (
      req.user.role !== 'admin' &&
      duty.doctorId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(duty);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.updateDuty = async (req, res) => {
  const { department, startDate, endDate, notes, status } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const duty = await Duty.findById(req.params.id);
    if (!duty) {
      return res.status(404).json({ msg: 'Duty not found' });
    }

    if (department) duty.department = department;
    if (startDate) duty.startDate = new Date(startDate);
    if (endDate) duty.endDate = new Date(endDate);
    if (notes !== undefined) duty.notes = notes;

    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ msg: 'End date must be after start date' });
      }
    }

    if (status) {
      const validStatuses = ['active', 'cancelled', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      duty.status = status;
    }

    await duty.save();

    // ✅ populate without execPopulate
    await duty.populate('doctorId', 'name');
    await duty.populate('assignedBy', 'name');

    res.json({
      msg: 'Duty updated successfully',
      duty
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};



exports.cancelDuty = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const duty = await Duty.findById(req.params.id);
    if (!duty) {
      return res.status(404).json({ msg: 'Duty not found' });
    }

    duty.status = 'cancelled';
    await duty.save();

    res.json({ msg: 'Duty cancelled successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllDuties = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { department, status, dateFrom, dateTo, doctorId } = req.query;
    let filter = {};

    if (department) filter.department = department;
    if (status) filter.status = status;
    if (doctorId) filter.doctorId = doctorId;

    if (dateFrom || dateTo) {
      filter.startDate = {};
      if (dateFrom) filter.startDate.$gte = new Date(dateFrom);
      if (dateTo) filter.startDate.$lte = new Date(dateTo);
    }

    const duties = await Duty.find(filter)
      .populate('doctorId', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ startDate: 1 });

    res.json(duties);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getDutyStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const total = await Duty.countDocuments({ status: 'active' });
    const byDepartment = await Duty.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]);
    const byStatus = await Duty.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    
    const topDoctors = await Duty.aggregate([
      { $match: { status: 'active' } },
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
      totalActive: total,
      byDepartment,
      byStatus,
      topDoctors
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};