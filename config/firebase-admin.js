const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    console.error('Make sure serviceAccountKey.json exists in config folder');
}

module.exports = admin;
