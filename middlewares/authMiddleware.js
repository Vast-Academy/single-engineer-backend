const admin = require('../config/firebase-admin');
const User = require('../models/User');

/**
 * Strict authentication middleware
 *
 * Verifies Firebase ID tokens from either:
 * 1. Authorization: Bearer <token> header (native apps)
 * 2. authToken cookie (web browsers)
 *
 * Rejects all requests without valid authentication.
 */
const verifyToken = async (req, res, next) => {
    const requestPath = req.path;
    const requestMethod = req.method;

    try {
        let token;
        let tokenSource;

        // Try to get token from Authorization header first (for native apps)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
            tokenSource = 'Authorization Bearer';
        }
        // Fall back to cookie (for web browsers)
        else if (req.cookies.authToken) {
            token = req.cookies.authToken;
            tokenSource = 'Cookie';
        }

        // STRICT: No token = immediate rejection
        if (!token) {
            console.warn(`❌ [AUTH BLOCKED] ${requestMethod} ${requestPath} - No token provided`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        // Verify Firebase ID token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token, true); // checkRevoked = true
        } catch (firebaseError) {
            // More specific Firebase errors
            if (firebaseError.code === 'auth/id-token-expired') {
                console.warn(`❌ [AUTH BLOCKED] ${requestMethod} ${requestPath} - Token expired`);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication token expired. Please refresh.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (firebaseError.code === 'auth/id-token-revoked') {
                console.warn(`❌ [AUTH BLOCKED] ${requestMethod} ${requestPath} - Token revoked`);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication token revoked. Please login again.',
                    code: 'TOKEN_REVOKED'
                });
            }
            throw firebaseError; // Other Firebase errors
        }

        // Find user in database
        const user = await User.findOne({ firebaseUid: decodedToken.uid });

        if (!user) {
            console.warn(`❌ [AUTH BLOCKED] ${requestMethod} ${requestPath} - User not found for UID: ${decodedToken.uid}`);
            return res.status(401).json({
                success: false,
                message: 'User account not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            console.warn(`❌ [AUTH BLOCKED] ${requestMethod} ${requestPath} - Account deactivated: ${user.email}`);
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact support.',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        // Success - Attach user to request object
        req.user = user;
        req.firebaseUser = decodedToken;

        console.log(`✓ [AUTH OK] ${requestMethod} ${requestPath} - User: ${user.email} (${tokenSource})`);
        next();

    } catch (error) {
        console.error(`❌ [AUTH ERROR] ${requestMethod} ${requestPath} - ${error.message}`);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed. Invalid token.',
            code: 'AUTH_ERROR'
        });
    }
};

module.exports = { verifyToken };
