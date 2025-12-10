const admin = require('../config/firebase-admin');
const User = require('../models/User');

// Google Sign In / Sign Up
const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: 'ID token is required.'
            });
        }

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture } = decodedToken;

        // Check if user exists, if not create new user
        let user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            // New user - Sign Up
            user = await User.create({
                firebaseUid: uid,
                email: email,
                displayName: name || '',
                photoURL: picture || ''
            });
            console.log('New user created:', email);
        } else {
            // Existing user - Update last login info if needed
            user.displayName = name || user.displayName;
            user.photoURL = picture || user.photoURL;
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Authentication successful.',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Google auth error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed.',
            error: error.message
        });
    }
};

// Get current user
const getCurrentUser = async (req, res) => {
    try {
        const user = req.user;

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        });
    } catch (error) {
        console.error('Get current user error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to get user details.'
        });
    }
};

// Logout user
const logout = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully.'
        });
    } catch (error) {
        console.error('Logout error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Logout failed.'
        });
    }
};

module.exports = {
    googleAuth,
    getCurrentUser,
    logout
};
