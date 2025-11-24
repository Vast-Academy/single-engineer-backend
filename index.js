const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection
const connectDB = require('./config/db');

// Routes
const routes = require('./routes');

// Notification Service
const { sendWorkOrderReminders, sendUpcomingReminders } = require('./services/notificationService');

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Engineer WebApp API Server',
        version: '1.0.0'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start notification scheduler - runs every minute
    setInterval(async () => {
        try {
            await sendWorkOrderReminders();
        } catch (error) {
            console.error('Notification scheduler error:', error);
        }
    }, 60000); // Every 1 minute

    // Send upcoming reminders every 5 minutes
    setInterval(async () => {
        try {
            await sendUpcomingReminders();
        } catch (error) {
            console.error('Upcoming reminder scheduler error:', error);
        }
    }, 300000); // Every 5 minutes

    console.log('Notification scheduler started');
});
