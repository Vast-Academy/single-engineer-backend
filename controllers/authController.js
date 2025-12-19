const admin = require('../config/firebase-admin');
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
                photoURL: user.photoURL,
                isPasswordSet: user.isPasswordSet
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
                photoURL: user.photoURL,
                isPasswordSet: user.isPasswordSet,
                businessProfile: user.businessProfile || {
                    businessName: '',
                    ownerName: '',
                    address: '',
                    state: '',
                    city: '',
                    pincode: '',
                    isComplete: false,
                    completedAt: null
                }
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

// Set/Update Password
const setPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const user = req.user; // from verifyToken middleware

        // Validation
        if (!password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and confirm password do not match'
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Update user record
        user.password = hashedPassword;
        user.isPasswordSet = true;
        await user.save();

        console.log('Password set successfully for user:', user.email);

        return res.status(200).json({
            success: true,
            message: 'Password set successfully'
        });
    } catch (error) {
        console.error('Set password error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to set password'
        });
    }
};

// Email/Password Login
const emailPasswordLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found or invalid credentials'
            });
        }

        // Check if password is set
        if (!user.isPasswordSet || !user.password) {
            return res.status(400).json({
                success: false,
                message: 'Password not set. Please use Google Sign In'
            });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'User not found or invalid credentials'
            });
        }

        // Generate Firebase custom token
        const customToken = await admin.auth().createCustomToken(user.firebaseUid);

        console.log('Email/password login successful:', user.email);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            customToken: customToken,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                isPasswordSet: user.isPasswordSet
            }
        });
    } catch (error) {
        console.error('Email/password login error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};

// Get Business Profile
const getBusinessProfile = async (req, res) => {
    try {
        const user = req.user;

        return res.status(200).json({
            success: true,
            data: user.businessProfile || {
                businessName: '',
                ownerName: '',
                address: '',
                state: '',
                city: '',
                pincode: '',
                isComplete: false,
                completedAt: null
            }
        });
    } catch (error) {
        console.error('Get business profile error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch business profile'
        });
    }
};

// Update Business Profile
const updateBusinessProfile = async (req, res) => {
    try {
        const { businessName, ownerName, address, state, city, pincode } = req.body;

        // Validation
        if (!businessName?.trim() || !ownerName?.trim() || !address?.trim() ||
            !state?.trim() || !city?.trim() || !pincode?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(pincode.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Pincode must be 6 digits'
            });
        }

        // Check profile completion
        const isComplete = true; // All fields are required, so if we reach here, it's complete

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                businessProfile: {
                    businessName: businessName.trim(),
                    ownerName: ownerName.trim(),
                    address: address.trim(),
                    state: state.trim(),
                    city: city.trim(),
                    pincode: pincode.trim(),
                    isComplete,
                    completedAt: isComplete ? new Date() : null
                }
            },
            { new: true, runValidators: true }
        );

        console.log('Business profile updated for user:', user.email);

        return res.status(200).json({
            success: true,
            message: 'Business profile updated successfully',
            data: user.businessProfile
        });
    } catch (error) {
        console.error('Update business profile error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to update business profile'
        });
    }
};

module.exports = {
    googleAuth,
    getCurrentUser,
    logout,
    setPassword,
    emailPasswordLogin,
    getBusinessProfile,
    updateBusinessProfile
};
