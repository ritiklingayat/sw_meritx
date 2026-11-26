import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/errors.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export class BrevoService {
  /**
   * Check if Brevo credentials are fully configured and not placeholder values.
   */
  static isConfigured() {
    const key = env.BREVO_API_KEY;
    const sender = env.BREVO_SENDER_EMAIL;
    if (!key || !sender) return false;
    if (key.includes('your_brevo_api_key') || key.trim() === '') return false;
    if (sender.includes('your_verified_sender_email') || !sender.includes('@') || sender.trim() === '') return false;
    return true;
  }

  /**
   * Send a transactional email via the official Brevo Transactional Email API (v3).
   * Endpoint: https://api.brevo.com/v3/smtp/email
   */
  static async sendTransactionalEmail({ toEmail, toName, subject, htmlContent, textContent }) {
    if (!this.isConfigured()) {
      logger.error('❌ [Brevo Service Error] Brevo API credentials are not configured in backend/.env.', {
        hasApiKey: Boolean(env.BREVO_API_KEY && !env.BREVO_API_KEY.includes('your_brevo_api_key')),
        hasSenderEmail: Boolean(
          env.BREVO_SENDER_EMAIL &&
            !env.BREVO_SENDER_EMAIL.includes('your_verified_sender_email') &&
            env.BREVO_SENDER_EMAIL.includes('@')
        )
      });
      throw new BadRequestError(
        'Email service is not yet configured. Please configure BREVO_API_KEY and a verified BREVO_SENDER_EMAIL in backend/.env.'
      );
    }

    const senderEmail = env.BREVO_SENDER_EMAIL.trim();
    const senderName = (env.BREVO_SENDER_NAME || 'LGW MeritX').trim();

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: toEmail.trim().toLowerCase(),
          name: (toName || 'Candidate').trim()
        }
      ],
      subject,
      htmlContent,
      ...(textContent ? { textContent } : {})
    };

    let response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch (networkErr) {
      logger.error('❌ [Brevo Service] Network connection to Brevo API failed:', networkErr);
      throw new BadRequestError('Failed to connect to email delivery service. Please verify server internet connectivity.');
    }

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = responseData?.message || responseData?.error || response.statusText;
      const errorCode = responseData?.code || response.status;

      logger.error('❌ [Brevo API Error]', {
        status: response.status,
        code: errorCode,
        message: errorMsg,
        toEmail
      });

      if (response.status === 401) {
        throw new BadRequestError('Invalid Brevo API key. Please check the BREVO_API_KEY in backend/.env.');
      }
      if (response.status === 403 || String(errorMsg).toLowerCase().includes('sender')) {
        throw new BadRequestError(
          `Brevo sender email (${senderEmail}) is unverified or forbidden. Please verify your sender email in the Brevo console.`
        );
      }
      if (response.status === 400) {
        throw new BadRequestError(`Brevo email delivery error: ${errorMsg}`);
      }

      throw new BadRequestError(`Email delivery failed (${response.status}): ${errorMsg}`);
    }

    logger.info(`✅ [Brevo Service] Transactional email sent successfully to ${toEmail}. Message ID: ${responseData.messageId}`);
    return {
      success: true,
      messageId: responseData.messageId
    };
  }

  /**
   * Build the responsive branded LGW MeritX HTML email layout.
   */
  static buildEmailTemplate({ title, subtitle, name, bodyContent, otp, expiryMinutes = 5, note }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-spacing: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f7fb;
      padding: 40px 15px;
    }
    .main-card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0d254c 0%, #1e4b8a 50%, #2563eb 100%);
      padding: 32px 30px;
      text-align: center;
      color: #ffffff;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0;
      color: #ffffff;
    }
    .brand-tag {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #93c5fd;
      font-weight: 700;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-container {
      background: #f0f7ff;
      border: 2px dashed #3b82f6;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #1e40af;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #1d4ed8;
      padding-left: 12px;
      margin: 0;
    }
    .otp-expiry {
      margin-top: 10px;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .security-notice {
      background-color: #f8fafc;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
      margin-top: 24px;
    }
    .security-notice strong {
      color: #b45309;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 30px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer-links a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <div class="header">
        <h1 class="brand-title">LGW MERITX</h1>
        <div class="brand-tag">Online Examination &amp; Digital Hub</div>
      </div>
      <div class="content">
        <div class="greeting">Hello ${escapeHtml(name || 'Candidate')},</div>
        <div class="lead-text">${bodyContent}</div>

        <div class="otp-container">
          <div class="otp-label">Your Verification Code</div>
          <div class="otp-code">${escapeHtml(otp)}</div>
          <div class="otp-expiry">⏱ Valid for <strong>${expiryMinutes} minutes</strong> only</div>
        </div>

        ${note ? `<div class="lead-text" style="font-size: 13px; color: #64748b;">${note}</div>` : ''}

        <div class="security-notice">
          <strong>🔒 Security Notice:</strong> Never share this 6-digit code or your account password with anyone. LGW MeritX staff will never ask for your verification code. If you did not initiate this request, you can safely ignore this email.
        </div>
      </div>
      <div class="footer">
        <div><strong>LGW MeritX Examination Platform</strong> · Learn. Practice. Rise.</div>
        <div style="margin-top: 6px;">This is an automated system notification. Please do not reply directly to this email.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Send Registration OTP email.
   */
  static async sendRegistrationOtpEmail({ email, name, otp }) {
    const subject = `Your LGW MeritX Verification Code: ${otp}`;
    const bodyContent =
      'Thank you for registering on the LGW MeritX examination platform. To verify your email address and proceed with creating your student account, please enter the 6-digit verification code below:';

    const textContent = `Hello ${name || 'Candidate'},\n\nThank you for registering with LGW MeritX.\n\nYour 6-digit email verification code is: ${otp}\n\nThis code is valid for 5 minutes only.\n\nSecurity Notice: LGW MeritX will never ask for your code. If you did not register, please ignore this email.`;

    const htmlContent = this.buildEmailTemplate({
      title: 'LGW MeritX - Email Verification',
      subtitle: 'Student Registration Verification',
      name,
      bodyContent,
      otp,
      expiryMinutes: 5,
      note: 'After entering this verification code, you will be able to finalize your student account details.'
    });

    return await this.sendTransactionalEmail({
      toEmail: email,
      toName: name,
      subject,
      htmlContent,
      textContent
    });
  }

  /**
   * Send Forgot Password OTP email.
   */
  static async sendPasswordResetOtpEmail({ email, name, otp }) {
    const subject = `LGW MeritX Password Reset Code: ${otp}`;
    const bodyContent =
      'We received a request to reset the password for your LGW MeritX student account. Please use the 6-digit verification code below to authorize this password reset:';

    const textContent = `Hello ${name || 'Candidate'},\n\nWe received a request to reset your LGW MeritX student password.\n\nYour 6-digit reset code is: ${otp}\n\nThis code is valid for 5 minutes only.\n\nSecurity Notice: If you did not request this password reset, please ignore this email and your password will remain unchanged.`;

    const htmlContent = this.buildEmailTemplate({
      title: 'LGW MeritX - Password Reset',
      subtitle: 'Reset Your Student Password',
      name,
      bodyContent,
      otp,
      expiryMinutes: 5,
      note: 'Enter this code in the password reset form to set a new password for your account.'
    });

    return await this.sendTransactionalEmail({
      toEmail: email,
      toName: name,
      subject,
      htmlContent,
      textContent
    });
  }
}
