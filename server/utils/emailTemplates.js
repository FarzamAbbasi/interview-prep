// HTML + plain-text email templates.
// Inline styles only: most email apps (Gmail, Outlook) ignore <style> blocks.

const APP_NAME = () => process.env.EMAIL_FROM_NAME || 'AskedIn';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function layout({ heading, intro, buttonText, link, note }) {
  const appName = escapeHtml(APP_NAME());
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #E2E8F0;font-size:18px;font-weight:bold;color:#6D4BD8;">
                ${appName}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:#0F172A;">${heading}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background:#6D4BD8;">
                      <a href="${link}" target="_blank"
                         style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                        ${buttonText}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 8px;font-size:13px;color:#64748B;">If the button does not work, copy this link into your browser:</p>
                <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#6D4BD8;">${link}</a></p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">${note}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">&copy; ${new Date().getFullYear()} ${appName}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function verificationEmail({ name, link }) {
  const appName = APP_NAME();
  return {
    subject: `Verify your email for ${appName}`,
    html: layout({
      heading: `Welcome, ${escapeHtml(name)}!`,
      intro: `Thanks for signing up. Please confirm your email address to start preparing for your interviews.`,
      buttonText: 'Verify email',
      link,
      note: `This link expires in 24 hours. If you did not create an account, you can ignore this email.`,
    }),
    text: `Welcome, ${name}!\n\nVerify your email for ${appName} by opening this link:\n${link}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.`,
  };
}

function resetPasswordEmail({ name, link }) {
  const appName = APP_NAME();
  return {
    subject: `Reset your ${appName} password`,
    html: layout({
      heading: `Hi ${escapeHtml(name)},`,
      intro: `We received a request to reset your password. Click the button below to choose a new one.`,
      buttonText: 'Reset password',
      link,
      note: `This link expires in 1 hour and can be used once. If you did not request a reset, ignore this email; your password will not change.`,
    }),
    text: `Hi ${name},\n\nReset your ${appName} password by opening this link:\n${link}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email.`,
  };
}

module.exports = { verificationEmail, resetPasswordEmail };
