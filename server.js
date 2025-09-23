// server/server.js
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(morgan('dev')); // HTTP request logger

// Serve static files (for uploads, reports, receipts)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/duties', require('./routes/duties'));
app.use('/api/recommendations', require('./routes/recommendations'));

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    message: '🏥 St. Mercy Hospital API Running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      appointments: '/api/appointments',
      reports: '/api/reports',
      payments: '/api/payments',
      messages: '/api/messages',
      complaints: '/api/complaints',
      duties: '/api/duties',
      recommendations: '/api/recommendations',
    },
  });
});

// Handle 404 (must be before error handler)
app.use('*', (req, res) => {
  res.status(404).json({
    msg: 'Route not found',
    path: req.originalUrl,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err.stack);
  res.status(500).json({
    msg: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`🏥 API Base URL: http://localhost:${PORT}`);
});
