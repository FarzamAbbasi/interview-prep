const nodemailer = require('nodemailer');

/**
 * Two ways to send email (IPP-1201):
 *   - BREVO_API_KEY set  -> Brevo HTTP API (used on Render: the free plan blocks SMTP ports)
 *   - otherwise          -> Gmail SMTP with SMTP_USER / SMTP_PASS (local development)
 */
const BREVO_URL = 'https://api.brevo.com/v3';

const useBrevo = () => Boolean(process.env.BREVO_API_KEY);
const smtpConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
const isEmailConfigured = () => useBrevo() || smtpConfigured();

// Which provider is active (shown by the test script)
const emailProvider = () => (useBrevo() ? 'Brevo API' : smtpConfigured() ? 'Gmail SMTP' : 'none');

// Sender address: EMAIL_FROM (must be a verified sender in Brevo), else the Gmail login
const fromName = () => process.env.EMAIL_FROM_NAME || 'AskedIn';
const fromEmail = () => process.env.EMAIL_FROM || process.env.SMTP_USER;

// ---------- Gmail SMTP ----------
let transporter = null;

// Create the SMTP connection once and reuse it
function getTransporter() {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      // Gmail shows app passwords with spaces ("abcd efgh ..."); remove them
      pass: String(process.env.SMTP_PASS).replace(/\s+/g, ''),
    },
  });
  return transporter;
}

// ---------- Brevo HTTP API ----------
async function brevoRequest(path, options = {}) {
  const response = await fetch(`${BREVO_URL}${path}`, {
    ...options,
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo ${response.status}: ${data.message || response.statusText}`);
  }
  return data;
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 *
 * In development without any email settings, the email is printed in the terminal
 * instead of being sent, so other features can still be tested.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured (BREVO_API_KEY or SMTP_USER / SMTP_PASS missing)');
    }
    console.log('\n[email:dev] Email not configured, email not sent. Preview:');
    console.log(`  To: ${to}\n  Subject: ${subject}\n  ${text || '(html only)'}\n`);
    return { preview: true };
  }

  if (useBrevo()) {
    if (!fromEmail()) throw new Error('EMAIL_FROM is not set (the verified sender address in Brevo)');
    const data = await brevoRequest('/smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        sender: { name: fromName(), email: fromEmail() },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(text ? { textContent: text } : {}),
      }),
    });
    return { messageId: data.messageId };
  }

  const info = await getTransporter().sendMail({
    from: `"${fromName()}" <${fromEmail()}>`,
    to,
    subject,
    html,
    text,
  });
  return { messageId: info.messageId };
}

// Check the login without sending anything (used by the test script)
async function verifyEmailConnection() {
  if (!isEmailConfigured()) throw new Error('No email settings: set BREVO_API_KEY, or SMTP_USER / SMTP_PASS');
  if (useBrevo()) {
    await brevoRequest('/account', { method: 'GET' });
    return true;
  }
  await getTransporter().verify();
  return true;
}

module.exports = { sendEmail, verifyEmailConnection, isEmailConfigured, emailProvider };
