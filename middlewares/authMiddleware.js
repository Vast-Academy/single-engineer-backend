const admin = require('../config/firebase-admin');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
    try {
        // Get token from cookie
        const token = req.cookies.authToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Find user in database
        const user = await User.findOne({ firebaseUid: decodedToken.uid });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated.'
            });
        }

        // Attach user to request object
        req.user = user;
        req.firebaseUser = decodedToken;

        next();
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
};

module.exports = { verifyToken };
