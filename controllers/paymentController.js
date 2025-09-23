const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid'); // npm install uuid


exports.getPatientPayments = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ msg: 'Access denied. Patients only.' });
    }

    const payments = await Payment.find({ 
      patientId: req.user.id 
    })
    .populate('appointmentId', 'date reason')
    .sort({ createdAt: -1 });

    res.json(payments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('appointmentId', 'date reason');

    if (!payment) {
      return res.status(404).json({ msg: 'Payment not found' });
    }


    if (
      req.user.role !== 'admin' &&
      payment.patientId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(payment);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.payBill = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ msg: 'Only patients can pay bills' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ msg: 'Payment not found' });
    }

 
    if (payment.status === 'paid') {
      return res.status(400).json({ msg: 'Bill already paid' });
    }

    if (payment.patientId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

  
    payment.status = 'paid';
    payment.paidAt = Date.now();
    payment.paymentMethod = 'stripe'; 
    payment.receiptUrl = `/receipts/${payment._id}.pdf`; 

    await payment.save();

   
    console.log(`📧 Receipt generated for ${payment.invoiceNumber}`);

    res.json({
      msg: 'Payment successful. Receipt sent to your email.',
      payment
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllPayments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, dateFrom, dateTo, patientId } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (patientId) filter.patientId = patientId;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const payments = await Payment.find(filter)
      .populate('patientId', 'name email')
      .populate('appointmentId', 'date reason')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updatePayment = async (req, res) => {
  const { status, paymentMethod, notes } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ msg: 'Payment not found' });
    }

    if (status) {
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      payment.status = status;
      if (status === 'paid' && !payment.paidAt) {
        payment.paidAt = Date.now();
      }
      if (status === 'refunded') {
        payment.refundedAt = Date.now();
      }
    }

    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (notes) payment.adminNotes = notes;

    await payment.save();

  
    await payment.populate('patientId', 'name').execPopulate();

    res.json({
      msg: 'Payment updated successfully',
      payment
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getPaymentStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const byStatus = await Payment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } }
    ]);

    const byMonth = await Payment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: { 
            year: { $year: "$paidAt" }, 
            month: { $month: "$paidAt" } 
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);


    const topPatients = await Payment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: "$patientId",
          totalSpent: { $sum: "$amount" },
          visits: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'patient'
        }
      },
      { $unwind: '$patient' },
      {
        $project: {
          _id: 0,
          patientName: '$patient.name',
          totalSpent: 1,
          visits: 1
        }
      }
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      byStatus,
      byMonth,
      topPatients
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.generateReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('appointmentId');

    if (!payment) {
      return res.status(404).json({ msg: 'Payment not found' });
    }

    if (
      req.user.role !== 'admin' &&
      payment.patientId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }


    const receiptData = {
      invoiceNumber: payment.invoiceNumber,
      patientName: payment.patientId.name,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      items: [
        {
          description: `Consultation on ${payment.appointmentId?.date?.toLocaleDateString() || 'N/A'}`,
          amount: payment.amount
        }
      ]
    };


    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.invoiceNumber}.json"`);
    
    res.json({
      msg: 'In production, this would be a PDF. Here’s the receipt ',
      ...receiptData
    });


  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};