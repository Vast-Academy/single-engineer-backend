const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection
const connectDB = require('./config/db');

// Routes
const routes = require('./routes');

// Notification Service
const { sendWorkOrderReminders, purgeOldFcmTokens } = require('./services/notificationService');

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://single-engineer-frontend.vercel.app',
    process.env.FRONTEND_URL,
    'capacitor://localhost',  // Add this for Android
    'http://localhost',
    'https://localhost',
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    // Purge old FCM tokens once a day
    setInterval(async () => {
        try {
            const ttlDays = parseInt(process.env.FCM_TOKEN_TTL_DAYS || '60', 10);
            await purgeOldFcmTokens(ttlDays);
        } catch (error) {
            console.error('FCM token purge error:', error);
        }
    }, 86400000); // Every 24 hours

    console.log('Notification scheduler started');
});
