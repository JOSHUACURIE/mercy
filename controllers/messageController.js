
const Message = require('../models/Message');
const User = require('../models/User');


exports.sendMessage = async (req, res) => {
  const { subject, body, category, priority = 'medium' } = req.body;

  try {

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Only doctors can send messages to admin' });
    }

  
    const validCategories = ['clinical', 'scheduling', 'urgent', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ msg: 'Invalid category. Use: clinical, scheduling, urgent, other.' });
    }

 
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ msg: 'Invalid priority. Use: low, medium, high.' });
    }

   
    const admin = await User.findOne({ role: 'admin', isDeleted: false });
    if (!admin) {
      return res.status(400).json({ msg: 'No active admin found to receive message' });
    }

    const message = new Message({
      senderId: req.user.id,
      receiverId: admin._id,
      subject,
      body,
      category,
      priority,
      status: 'unread'
    });

    await message.save();

   
    await message.populate('senderId', 'name email role').execPopulate();

    res.status(201).json({
      msg: 'Message sent to admin successfully',
      message
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getSentMessages = async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const messages = await Message.find({ 
      senderId: req.user.id,
      isArchived: false 
    })
    .populate('receiverId', 'name email')
    .sort({ createdAt: -1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getMessageById = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('senderId', 'name email role')
      .populate('receiverId', 'name email role');

    if (!message || message.isArchived) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    if (
      message.senderId._id.toString() !== req.user.id &&
      message.receiverId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getAllMessages = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, category, priority, senderId } = req.query;
    let filter = { 
      receiverId: req.user.id, 
      isArchived: false 
    };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (senderId) filter.senderId = senderId;

    const messages = await Message.find(filter)
      .populate('senderId', 'name email role')
      .sort({ priority: -1, createdAt: -1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.updateMessage = async (req, res) => {
  const { status } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const message = await Message.findById(req.params.id);
    if (!message || message.isArchived) {
      return res.status(404).json({ msg: 'Message not found' });
    }

 
    if (message.receiverId.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (status) {
      const validStatuses = ['unread', 'read', 'resolved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      message.status = status;
      if (status === 'read' || status === 'resolved') {
        message.repliedAt = Date.now();
      }
    }

    await message.save();

  
    await message.populate('senderId', 'name').execPopulate();

    res.json({
      msg: 'Message updated successfully',
      message
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.archiveMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }


    if (
      message.senderId.toString() !== req.user.id &&
      message.receiverId.toString() !== req.user.id
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    message.isArchived = true;
    await message.save();

    res.json({ msg: 'Message archived successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};


exports.getMessageStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const total = await Message.countDocuments({ 
      receiverId: req.user.id, 
      isArchived: false 
    });
    const unread = await Message.countDocuments({ 
      receiverId: req.user.id, 
      status: 'unread',
      isArchived: false 
    });
    const byPriority = await Message.aggregate([
      { $match: { receiverId: req.user.id, isArchived: false } },
      { $group: { _id: "$priority", count: { $sum: 1 } } }
    ]);
    const byCategory = await Message.aggregate([
      { $match: { receiverId: req.user.id, isArchived: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      unread,
      byPriority,
      byCategory
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};