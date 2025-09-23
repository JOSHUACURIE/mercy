
const MedicalReport = require('../models/MedicalReport');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

exports.createReport = async (req, res) => {
  const { appointmentId, diagnosis, prescriptions, notes } = req.body;

  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Only doctors can create medical reports' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(400).json({ msg: 'Invalid appointment ID' });
    }

    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to create report for this appointment' });
    }

    const patient = await User.findById(appointment.patientId);
    if (!patient || patient.role !== 'patient') {
      return res.status(400).json({ msg: 'Invalid patient' });
    }

    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
      return res.status(400).json({ msg: 'At least one prescription is required' });
    }

    for (let rx of prescriptions) {
      if (!rx.medicine || !rx.dosage || !rx.frequency || !rx.duration) {
        return res.status(400).json({ msg: 'Each prescription requires medicine, dosage, frequency, and duration' });
      }
    }

    // Create report in DB
    const report = new MedicalReport({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: req.user.id,
      diagnosis,
      prescriptions,
      notes: notes || ''
    });

    await report.save();

    // Generate PDF
    const pdfPath = path.join(__dirname, '../reports', `report-${report._id}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(pdfPath));

    // PDF content
    doc.fontSize(20).text('Medical Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Report ID: ${report._id}`);
    doc.text(`Generated At: ${new Date().toLocaleString()}`);
    doc.text(`Appointment Date: ${appointment.date}`);
    doc.moveDown();

    doc.text(`Patient Name: ${patient.name}`);
    doc.text(`Patient Email: ${patient.email}`);
    doc.text(`Doctor Name: ${req.user.name}`);
    doc.text(`Doctor Email: ${req.user.email}`);
    doc.moveDown();

    doc.fontSize(14).text('Diagnosis:', { underline: true });
    doc.fontSize(12).text(diagnosis || 'N/A');
    doc.moveDown();

    doc.fontSize(14).text('Prescriptions:', { underline: true });
    prescriptions.forEach((rx, index) => {
      doc.fontSize(12).text(
        `${index + 1}. Medicine: ${rx.medicine}, Dosage: ${rx.dosage}, Frequency: ${rx.frequency}, Duration: ${rx.duration}`
      );
    });
    doc.moveDown();

    doc.fontSize(14).text('Additional Notes:', { underline: true });
    doc.fontSize(12).text(notes || 'N/A');

    doc.end();

    // Save PDF URL in report document
    report.pdfUrl = `/reports/report-${report._id}.pdf`;
    await report.save();

    // Populate for response
    await report.populate('patientId', 'name email');
    await report.populate('doctorId', 'name email');

    console.log(`📄 Report generated for patient ${patient.name}. PDF saved at ${pdfPath}`);

    res.status(201).json({
      msg: 'Medical report created successfully',
      report
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getPatientReports = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ msg: 'Access denied. Patients only.' });
    }

    const reports = await MedicalReport.find({ patientId: req.user.id })
      .populate('doctorId', 'name email')
      .populate('appointmentId', 'date reason')
      .sort({ createdAt: -1 });

    // ✅ Always respond with 200 + array
    return res.status(200).json(reports || []);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getDoctorReports = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Access denied. Doctors only.' });
    }

    const reports = await MedicalReport.find({ doctorId: req.user.id })
      .populate('patientId', 'name email')
      .populate('appointmentId', 'date reason')
      .sort({ createdAt: -1 });

    // ✅ Always respond with 200 + array
    return res.status(200).json(reports || []);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email')
      .populate('appointmentId', 'date reason');

    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }


    if (
      req.user.role !== 'admin' &&
      report.patientId._id.toString() !== req.user.id &&
      report.doctorId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(report);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.downloadReportPDF = async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email department')
      .populate('appointmentId', 'date');

    if (!report) return res.status(404).json({ msg: 'Report not found' });

    if (
      req.user.role !== 'admin' &&
      report.patientId._id.toString() !== req.user.id &&
      report.doctorId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="medical-report-${report._id}.pdf"`);

    const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4',
      layout: 'portrait'
    });
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 30;
    const usableWidth = pageWidth - (margin * 2);
    
    let currentY = margin;

    // Helper function to add section with proper spacing
    const addSection = (title, content, spacing = 0.3) => {
      // Check if we have enough space for the section
      if (currentY > pageHeight - 150) {
        // Reset to smaller spacing if needed
        currentY = Math.min(currentY, pageHeight - 120);
      }
      
      if (title) {
        doc.font('Helvetica-Bold').fontSize(10).text(title, margin, currentY, { underline: true });
        currentY += 15;
      }
      
      if (content) {
        doc.font('Helvetica').fontSize(9);
        const textHeight = doc.heightOfString(content, { width: usableWidth });
        doc.text(content, margin, currentY, { width: usableWidth });
        currentY += textHeight + (spacing * 20);
      }
    };

    // Header with Logo and Hospital Name inline
    const logoPath = path.join(__dirname, 'logo.png');
    const logoSize = 40;
    const headerY = currentY;
    
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, margin, headerY, { width: logoSize });
      } catch (err) {
        console.error('Failed to add logo:', err.message);
      }
    }

    // Hospital Name inline with logo
    doc.font('Helvetica-Bold').fontSize(16).text('St. Mercy Hospital', margin + logoSize + 15, headerY + 5);
    doc.fontSize(12).text('Medical Report', margin + logoSize + 15, headerY + 25);
    
    currentY += logoSize + 15;
    
    // Professional line separator
    doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
    currentY += 20;

    // Patient & Doctor Information in two columns
    doc.font('Helvetica-Bold').fontSize(10).text('Patient & Medical Information', margin, currentY, { underline: true });
    currentY += 18;
    
    // Left column - Patient info
    const leftColX = margin;
    const rightColX = margin + (usableWidth / 2) + 10;
    
    doc.font('Helvetica').fontSize(9);
    let leftY = currentY;
    doc.text(`Report ID: ${report._id}`, leftColX, leftY);
    leftY += 12;
    doc.text(`Date: ${new Date(report.appointmentId?.date || report.createdAt).toLocaleDateString()}`, leftColX, leftY);
    leftY += 12;
    doc.text(`Patient: ${report.patientId.name}`, leftColX, leftY);
    leftY += 12;
    doc.text(`Email: ${report.patientId.email}`, leftColX, leftY);
    
    // Right column - Doctor info
    let rightY = currentY;
    doc.text(`Doctor: ${report.doctorId.name}`, rightColX, rightY);
    rightY += 12;
    doc.text(`Email: ${report.doctorId.email}`, rightColX, rightY);
    rightY += 12;
    doc.text(`Department: ${report.doctorId.department || 'General Medicine'}`, rightColX, rightY);
    
    currentY = Math.max(leftY, rightY) + 20;
    
    // Line separator
    doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
    currentY += 15;

    // Diagnosis Section
    doc.font('Helvetica-Bold').fontSize(10).text('Diagnosis', margin, currentY, { underline: true });
    currentY += 15;
    doc.font('Helvetica').fontSize(9);
    const diagnosisHeight = doc.heightOfString(report.diagnosis, { width: usableWidth });
    doc.text(report.diagnosis, margin, currentY, { width: usableWidth });
    currentY += diagnosisHeight + 15;
    
    // Line separator
    doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
    currentY += 15;

    // Prescriptions Table (Compact)
    doc.font('Helvetica-Bold').fontSize(10).text(`Prescriptions (${report.prescriptions.length} items)`, margin, currentY, { underline: true });
    currentY += 15;

    if (report.prescriptions.length > 0) {
      // Table with optimized column widths
      const colWidths = [20, 140, 80, 80, 80]; // Adjusted for better fit
      const tableStartX = margin;
      
      // Table header
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('#', tableStartX, currentY);
      doc.text('Medicine', tableStartX + colWidths[0], currentY);
      doc.text('Dosage', tableStartX + colWidths[0] + colWidths[1], currentY);
      doc.text('Frequency', tableStartX + colWidths[0] + colWidths[1] + colWidths[2], currentY);
      doc.text('Duration', tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
      currentY += 15;
      
      // Underline header
      doc.moveTo(tableStartX, currentY - 2).lineTo(pageWidth - margin, currentY - 2).stroke();
      currentY += 3;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      report.prescriptions.forEach((rx, i) => {
        doc.text(`${i + 1}`, tableStartX, currentY);
        doc.text(rx.medicine, tableStartX + colWidths[0], currentY, { width: colWidths[1] - 5 });
        doc.text(rx.dosage, tableStartX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] - 5 });
        doc.text(rx.frequency, tableStartX + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] - 5 });
        doc.text(rx.duration, tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY, { width: colWidths[4] - 5 });
        currentY += 12;
      });
      currentY += 10;
    }
    
    // Line separator
    doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
    currentY += 15;

    // Doctor's Notes (if available)
    if (report.notes && report.notes.trim()) {
      doc.font('Helvetica-Bold').fontSize(10).text("Doctor's Notes", margin, currentY, { underline: true });
      currentY += 15;
      doc.font('Helvetica').fontSize(9);
      const notesHeight = doc.heightOfString(report.notes, { width: usableWidth });
      doc.text(report.notes, margin, currentY, { width: usableWidth });
      currentY += notesHeight + 20;
    }

    // Professional Footer - positioned relative to content, not fixed
    const footerY = Math.max(currentY + 15, pageHeight - 60);
    doc.moveTo(margin, footerY - 10).lineTo(pageWidth - margin, footerY - 10).stroke();
    
    // Generation timestamp and signature line
    doc.font('Helvetica').fontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, footerY, { align: 'left' });
    doc.text('Doctor Signature: ________________________', pageWidth - 200, footerY, { align: 'right' });

    // Confidentiality notice
    doc.fontSize(7).text('CONFIDENTIAL - This medical report contains private health information', margin, footerY + 15, { 
      align: 'center',
      width: usableWidth 
    });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err.message);
    if (!res.headersSent) res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllReports = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { doctorId, patientId, dateFrom, dateTo } = req.query;
    let filter = {};

    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const reports = await MedicalReport.find(filter)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email')
      .populate('appointmentId', 'date reason')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};




exports.getReportStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const totalReports = await MedicalReport.countDocuments();


    const byDoctor = await MedicalReport.aggregate([
      { $group: { _id: "$doctorId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      { $unwind: '$doctor' },
      { $project: { _id: 0, doctorName: '$doctor.name', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    
    const topMedicines = await MedicalReport.aggregate([
      { $unwind: "$prescriptions" },
      { $group: { _id: "$prescriptions.medicine", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);


    const byMonth = await MedicalReport.aggregate([
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.json({
      totalReports,
      byDoctor,
      topMedicines,
      byMonth
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updateReport = async (req, res) => {
  const { diagnosis, prescriptions, notes } = req.body;

  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Only doctors can update reports' });
    }

    const report = await MedicalReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

 
    if (report.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (diagnosis) report.diagnosis = diagnosis;
    if (prescriptions) {
    
      if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
        return res.status(400).json({ msg: 'At least one prescription is required' });
      }
      for (let rx of prescriptions) {
        if (!rx.medicine || !rx.dosage || !rx.frequency || !rx.duration) {
          return res.status(400).json({ msg: 'Each prescription requires all fields' });
        }
      }
      report.prescriptions = prescriptions;
    }
    if (notes !== undefined) report.notes = notes;

    await report.save();

    
    report.pdfUrl = `/reports/${report._id}.pdf`;
    await report.save();

    res.json({
      msg: 'Report updated successfully',
      report
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};