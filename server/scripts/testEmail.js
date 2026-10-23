/**
 * Email test: checks the email login (Brevo API or Gmail SMTP) and sends both templates.
 *
 *   npm run test:email -- you@example.com
 *
 * The links in these test emails are dummy links.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const { sendEmail, verifyEmailConnection, emailProvider } = require('../utils/sendEmail');
const { verificationEmail, resetPasswordEmail } = require('../utils/emailTemplates');

async function run() {
  const to = process.argv[2];
  if (!to) {
    console.log('Usage: npm run test:email -- you@example.com');
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`Checking ${emailProvider()} login...`);
    await verifyEmailConnection();
    console.log(`${emailProvider()} login OK`);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    const verify = verificationEmail({ name: 'Test User', link: `${clientUrl}/verify-email/test-token` });
    await sendEmail({ to, ...verify });
    console.log(`Sent: "${verify.subject}"`);

    const reset = resetPasswordEmail({ name: 'Test User', link: `${clientUrl}/reset-password/test-token` });
    await sendEmail({ to, ...reset });
    console.log(`Sent: "${reset.subject}"`);

    console.log(`\nDone. Check the inbox (and Spam folder) of ${to}`);
  } catch (error) {
    console.error('\nEmail test failed:', error.message);
    if (/Invalid login|BadCredentials|535/i.test(error.message)) {
      console.error('Hint: use a Gmail App Password (16 characters), not your normal Gmail password, and make sure 2-Step Verification is on.');
    }
    if (/Brevo 401/i.test(error.message)) {
      console.error('Hint: BREVO_API_KEY is wrong. Brevo -> SMTP & API -> API Keys -> create a new key.');
    }
    if (/sender/i.test(error.message)) {
      console.error('Hint: EMAIL_FROM must be a verified sender in Brevo (Senders, Domains & Dedicated IPs -> Senders).');
    }
    process.exitCode = 1;
  }
}

run();
