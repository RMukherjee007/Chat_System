const crypto = require('crypto');

function generateLobbyId(displayName) {
  // Take first 6 chars of name, uppercase, remove spaces, append random 4 char hex
  const namePart = displayName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${namePart}-${randomPart}`;
}

module.exports = { generateLobbyId };
