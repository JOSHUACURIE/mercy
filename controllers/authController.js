
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');


const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// ---------------- REGISTER PATIENT ----------------
exports.registerPatient = async (req, res) => {
  const { name, email } = req.body;

  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'Patient already exists' });

    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();

    const newPatient = new User({
      name,
      email,
      password: tempPassword, // pre-save hook will hash
      role: 'patient',
      isVerified: false
    });

    await newPatient.save();

    // ✅ Use generateToken
    const token = generateToken(newPatient._id, newPatient.role);

    res.status(201).json({
      msg: 'Patient created successfully',
      patient: {
        _id: newPatient._id,
        name: newPatient.name,
        email: newPatient.email,
        role: newPatient.role,
        isDeleted: newPatient.isDeleted,
        createdAt: newPatient.createdAt
      },
      tempPassword, // admin sees this
      token        // frontend stores in localStorage
    });

    console.log(`📧 TEMP PASSWORD for ${email}: ${tempPassword}`);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};
// ---------------- REGISTER DOCTOR ----------------
exports.registerDoctor = async (req, res) => {
  const { name, email, phone, department, specialty } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'Doctor already exists' });

    const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();

    user = new User({
      name,
      email,
      phone,
      password: tempPassword,
      role: 'doctor',
      department,
      specialty,
      isVerified: false
    });

    await user.save();

    // ✅ Use generateToken
    const token = generateToken(user._id, user.role);

    console.log(`👩‍⚕️ TEMP PASSWORD for Dr. ${name}: ${tempPassword}`);

    res.status(201).json({
      msg: 'Doctor created successfully',
      userId: user._id,
      tempPassword,
      token
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// server/controllers/authController.js
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    // ✅ Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // ✅ include role
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};


exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v').lean();
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updateProfile = async (req, res) => {
  const { name, phone } = req.body;

  try {
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (phone) updatedFields.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updatedFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);


    if (!user.isVerified) {
      user.password = newPassword; 
      user.isVerified = true; 
      await user.save();

      return res.json({ msg: 'Password updated successfully. Please log in again.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });

    user.password = newPassword; 
    await user.save();

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });

    const users = await User.find({ isDeleted: false })
      .select('-password -__v')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.toggleUserStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.isDeleted = !user.isDeleted;
    await user.save();

    res.json({
      msg: `User ${user.isDeleted ? 'deactivated' : 'activated'} successfully`,
      user
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.logout = (req, res) => {
  // ✅ With localStorage, logout is just frontend-side (clear localStorage)
  res.json({ msg: 'Logged out successfully (clear localStorage on frontend)' });
};
// Get all patients (for admin)
exports.getPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient' })
      .select('-password -__v') // Exclude sensitive info
      .sort({ createdAt: -1 })
      .lean(); // Optional, returns plain JS objects for easier handling

    // Send in { patients: [...] } format so frontend reads it correctly
    res.status(200).json({ patients });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ msg: 'Failed to fetch patients' });
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).sort({ createdAt: -1 });
    res.status(200).json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to load doctors' });
  }
};

exports.getAllDoctorsForPatients = async (req, res) => {
  try {
    // Only fetch doctors who are active (not deleted)
    const doctors = await User.find({ role: 'doctor', isDeleted: false })
      .select('name email specialty department'); // only return necessary fields

    res.json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server Error' });
  }
};
