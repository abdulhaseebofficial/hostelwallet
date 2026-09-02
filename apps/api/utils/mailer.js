/**
 * Tiny mail helper. If SMTP settings are absent (the normal case in local dev
 * and in a college demo) it logs the message instead of failing, so the
 * forgot-password flow is always testable.
 */

const { isDevelopment } = require('../config/validateEnv');

let transporter = null;

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    // Required lazily so the app runs even if nodemailer is not installed.
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const tx = getTransporter();

  if (!tx) {
    // Printing the body is how the reset flow stays testable with no SMTP, but
    // that body carries a password-reset link. Outside local development the
    // logs are somewhere other people can read, and a link in them is an
    // account-takeover primitive - so say only that delivery failed.
    if (!isDevelopment()) {
      console.error(
        `[mail] NOT DELIVERED to ${to} ("${subject}") - no SMTP configured. ` +
          'Password reset cannot work until SMTP_HOST and SMTP_USER are set.'
      );
      return { delivered: false };
    }

    console.log('\n[mail] SMTP not configured - message logged instead of sent');
    console.log(`[mail] to: ${to}`);
    console.log(`[mail] subject: ${subject}`);
    console.log(`[mail] body:\n${text}\n`);
    return { delivered: false };
  }

  await tx.sendMail({
    from: process.env.MAIL_FROM || 'HostelWallet <no-reply@hostelwallet.app>',
    to,
    subject,
    text,
    html: html || `<p>${text.replace(/\n/g, '<br/>')}</p>`,
  });

  return { delivered: true };
};

module.exports = { sendMail, isConfigured };
