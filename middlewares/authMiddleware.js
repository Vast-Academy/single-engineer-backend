const admin = require('../config/firebase-admin');
const User = require('../models/User');

/**
 * Authentication middleware (Authorization header only)
 *
 * - Accepts ONLY Authorization: Bearer <idToken>
 * - No cookie fallback
 * - verifyIdToken without revoke check
 */
const verifyToken = async (req, res, next) => {
    const requestPath = req.path;
    const requestMethod = req.method;

    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - No Authorization Bearer token`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        if (!token) {
            console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - No token provided after parsing header`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        // Verify Firebase ID token (no revoke check)
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (firebaseError) {
            if (firebaseError.code === 'auth/id-token-expired') {
                console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - Token expired`);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication token expired. Please refresh.',
                    code: 'TOKEN_EXPIRED'
                });
            }

            console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - Invalid token ${firebaseError.code || ''}`);
            return res.status(401).json({
                success: false,
                message: 'Authentication failed. Invalid token.',
                code: 'AUTH_ERROR'
            });
        }

        // Ensure user exists and active
        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        if (!user) {
            console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - User not found for UID: ${decodedToken.uid}`);
            return res.status(401).json({
                success: false,
                message: 'User account not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        if (!user.isActive) {
            console.warn(`[AUTH BLOCKED] ${requestMethod} ${requestPath} - Account deactivated: ${user.email}`);
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact support.',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        req.user = user;
        req.firebaseUser = decodedToken;

        console.log(`[AUTH OK] ${requestMethod} ${requestPath} - User: ${user.email} (Authorization Bearer)`);
        next();
    } catch (error) {
        console.error(`[AUTH ERROR] ${requestMethod} ${requestPath} - ${error.message}`);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed.',
            code: 'AUTH_ERROR'
        });
    }
};

module.exports = { verifyToken };
