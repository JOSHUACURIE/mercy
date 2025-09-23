
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { v4: uuidv4 } = require('uuid'); 

exports.createAppointment = async (req, res) => {
  const { doctorId, date, reason } = req.body;

  try {
    const patientId = req.user.id;

    const patient = await User.findById(patientId);
    const doctor = await User.findById(doctorId);

    if (!patient || patient.role !== 'patient')
      return res.status(400).json({ msg: 'Invalid patient' });
    if (!doctor || doctor.role !== 'doctor')
      return res.status(400).json({ msg: 'Invalid doctor' });

    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime()) || appointmentDate < new Date())
      return res.status(400).json({ msg: 'Invalid date or in the past' });

    const existing = await Appointment.findOne({
      doctorId,
      date: appointmentDate,
      status: { $ne: 'cancelled' }
    });
    if (existing)
      return res.status(400).json({ msg: 'Time slot already booked' });

    const appointment = new Appointment({
      patientId,
      doctorId,
      date: appointmentDate,
      reason,
      status: 'scheduled'
    });

    await appointment.save();

    await appointment.populate([
      { path: 'patientId', select: 'name email' },
      { path: 'doctorId', select: 'name email specialty' }
    ]);

    res.status(201).json({
      msg: 'Appointment created successfully',
      appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ 
      patientId: req.user.id, 
      isDeleted: false 
    })
    .populate('doctorId', 'name email')
    .sort({ date: -1 }); 

    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getDoctorAppointments = async (req, res) => {
  try {
    const { range = 'today' } = req.query;
    let filter = { doctorId: req.user.id, isDeleted: false };

    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.setHours(0, 0, 0, 0));
      const end = new Date(now.setHours(23, 59, 59, 999));
      filter.date = { $gte: start, $lte: end };
    } else if (range === 'week') {
      const start = new Date(now.setDate(now.getDate() - now.getDay()));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'name email phone')
      .sort({ date: 1 }); 

    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email');

    if (!appointment || appointment.isDeleted) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    
    if (
      req.user.role !== 'admin' &&
      appointment.patientId._id.toString() !== req.user.id &&
      appointment.doctorId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(appointment);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updateAppointment = async (req, res) => {
  const { status, date, notes } = req.body;

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.isDeleted) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }


    if (
      req.user.role !== 'admin' &&
      appointment.doctorId.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

   
    if (status === 'completed' && appointment.status !== 'completed') {
      const payment = new Payment({
        patientId: appointment.patientId,
        appointmentId: appointment._id,
        amount: 100.0, 
        currency: 'USD',
        status: 'pending',
        invoiceNumber: `INV-${uuidv4().split('-')[0].toUpperCase()}`,
        createdAt: new Date()
      });
      await payment.save();
    }


    if (status) appointment.status = status;
    if (date) appointment.date = date;
    if (notes) appointment.notes = notes;
    appointment.updatedAt = Date.now();

    await appointment.save();

await appointment.populate([
  { path: 'patientId', select: 'name' },
  { path: 'doctorId', select: 'name' }
]);

res.json({
  msg: 'Appointment updated successfully',
  appointment
});

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.isDeleted) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    if (
      req.user.role !== 'admin' &&
      appointment.patientId.toString() !== req.user.id &&
      appointment.doctorId.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    appointment.status = 'cancelled';
    appointment.isDeleted = true;
    appointment.updatedAt = Date.now();
    await appointment.save();

    res.json({ msg: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getAllAppointments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, patientName } = req.query;

    // Base filter
    let filter = { isDeleted: false };
    if (status) filter.status = status;

    let appointments = await Appointment.find(filter)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email')
      .sort({ date: -1 })
      .lean();

    // Filter by patient name if provided
    if (patientName) {
      const regex = new RegExp(patientName, 'i');
      appointments = appointments.filter(a => a.patientId?.name.match(regex));
    }

    res.status(200).json(appointments);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ msg: 'Failed to fetch appointments' });
  }
};
