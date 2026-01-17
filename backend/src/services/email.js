const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;
const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

let transporter = null;

if (smtpHost && smtpUser && smtpPass && smtpFrom) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  console.warn('SMTP not configured. Investor verification emails will not send.');
}

async function sendVerificationEmail(to, code) {
  if (!transporter) {
    return { sent: false, error: 'SMTP not configured' };
  }

  const message = {
    from: smtpFrom,
    to,
    subject: 'SwipeStreet investor verification code',
    text: `Your SwipeStreet verification code is ${code}. It expires in 15 minutes.`,
  };

  try {
    const info = await transporter.sendMail(message);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send failed:', error);
    return { sent: false, error: error.message || 'Email send failed' };
  }
}

module.exports = {
  sendVerificationEmail,
};
