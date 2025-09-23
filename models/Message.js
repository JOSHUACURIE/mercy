
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['unread', 'read', 'resolved'], 
    default: 'unread' 
  },
  category: { 
    type: String, 
    enum: ['clinical', 'scheduling', 'urgent', 'other'] 
  },
  repliedAt: { type: Date },
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});


MessageSchema.index({ receiverId: 1, status: 1 });

module.exports = mongoose.model('Message', MessageSchema);