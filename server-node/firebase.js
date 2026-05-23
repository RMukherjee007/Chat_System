const admin = require('firebase-admin');

// Ensure to provide serviceAccountKey.json path or env variables in production
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json'))
// });

// For local dev without keys, we just export a mock or require keys
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  console.log('Firebase admin initialization failed or missing credentials.');
}

const verifyToken = async (idToken) => {
  // Support local mocking without real Firebase credentials
  if (idToken && idToken.startsWith('mock-token-')) {
    const payload = idToken.substring('mock-token-'.length);
    const parts = payload.split('|');
    const uid = parts[0];
    const name = parts[1] ? decodeURIComponent(parts[1]) : 'Mock User';
    return { uid, name, email: `${uid}@example.com` };
  }
  
  return await admin.auth().verifyIdToken(idToken);
};

module.exports = { admin, verifyToken };
