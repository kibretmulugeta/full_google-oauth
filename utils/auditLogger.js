const AuditLog = require('../models/AuditLog');

/**
 * Asynchronously log an authentication or security audit event
 */
async function logAuditEvent({ userId = null, email = '', action, req = null, details = '' }) {
  try {
    let ipAddress = '127.0.0.1';
    let userAgent = 'Unknown';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      userAgent = req.headers['user-agent'] || 'Unknown';
    }

    await AuditLog.create({
      userId,
      email: email ? email.toLowerCase() : '',
      action,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Audit Log Error:', error.message);
  }
}

module.exports = { logAuditEvent };
