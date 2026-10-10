/**
 * ============================================================================
 * FLEET FLOW — TRANSACTIONAL EMAIL SERVICE (emailService.ts)
 * ============================================================================
 * 
 * WHAT IS THIS SERVICE?
 * ---------------------
 * Handles automated dispatch of transactional emails for account recovery,
 * workspace invitations, security alerts, and system notifications.
 * Supports configurable SMTP transport (Nodemailer) with automated fallback
 * to structured, development-friendly console delivery.
 * ============================================================================
 */

import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;

  if ((host || user) && user && pass) {
    try {
      const config: any = {
        auth: { user, pass },
      };

      if (!host || host.includes('gmail.com')) {
        config.service = 'gmail';
      } else {
        config.host = host;
        config.port = port;
        config.secure = port === 465;
      }

      transporter = nodemailer.createTransport(config);
      return transporter;
    } catch (err) {
      console.warn('Failed to initialize SMTP transporter, falling back to console:', err);
    }
  }

  return null;
}

/**
 * Generic email dispatcher with graceful fallback
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const from = process.env.SMTP_FROM || (process.env.SMTP_USER ? `FleetFlow Security <${process.env.SMTP_USER}>` : 'FleetFlow Security <security@fleetflow.io>');
  const client = getTransporter();

  if (client) {
    try {
      await client.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
      });
      console.log(`✉️ [SMTP SENT] Email dispatched to: ${options.to} | Subject: "${options.subject}"`);
      return true;
    } catch (err: any) {
      console.warn(`SMTP delivery failed (${err.message}). Falling back to development logger:`);
    }
  }

  // Development / Test console delivery fallback
  console.log('\n======================================================');
  console.log('✉️  [TRANSACTIONAL EMAIL DISPATCH - DEV SIMULATOR]');
  console.log(`To:      ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log('------------------------------------------------------');
  if (options.text) {
    console.log(options.text);
  } else {
    console.log(options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  console.log('======================================================\n');

  return true;
}

/**
 * Sends a single-use 15-minute password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName: string = 'FleetFlow User'
): Promise<boolean> {
  const subject = 'Reset Your FleetFlow Password';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 22px;">Fleet Flow Logistics OS</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Security & Account Recovery Center</p>
      </div>

      <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        We received a request to reset the password associated with your workspace account (<strong>${to}</strong>).
      </p>

      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset My Password
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
        Or copy and paste this recovery URL into your web browser:<br />
        <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
      </p>

      <div style="margin-top: 24px; padding: 12px 16px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;">
        ⚠️ <strong>Security Advisory:</strong> This recovery link expires strictly in <strong>15 minutes</strong> and can only be used once. If you did not request a password reset, please ignore this email or notify your system administrator immediately.
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Fleet Flow Logistics Technologies Pvt. Ltd. · End-to-End Transport OS<br />
        Automated security message — please do not reply directly to this email.
      </p>
    </div>
  `;

  const text = `
Hello ${userName},

We received a request to reset your FleetFlow password.
Click or visit the link below to set a new password:
${resetUrl}

This link is valid for 15 minutes only.
If you did not request this, you can safely ignore this email.
  `.trim();

  return sendEmail({ to, subject, html, text });
}

/**
 * Sends security alert when account password is changed
 */
export async function sendPasswordChangedAlert(
  to: string,
  userName: string = 'FleetFlow User'
): Promise<boolean> {
  const subject = 'Security Alert: Your FleetFlow Password Was Changed';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">Password Changed Successfully</h2>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        The password for your FleetFlow workspace account (<strong>${to}</strong>) was recently changed. For your security, all existing sessions and tokens on other devices have been automatically invalidated.
      </p>
      <div style="margin-top: 16px; padding: 12px 16px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; font-size: 13px; color: #991b1b;">
        🛑 If you did NOT authorize this change, please contact your workspace administrator or reach out to support at <a href="mailto:security@fleetflow.io" style="color: #dc2626;">security@fleetflow.io</a> immediately.
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

/**
 * Sends team workspace onboarding invitation email
 */
export async function sendTeamInvitationEmail(
  to: string,
  inviteUrl: string,
  inviterName: string,
  companyName: string,
  role: string
): Promise<boolean> {
  const subject = `You've been invited to join ${companyName} on FleetFlow`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px;">Join Your Fleet Operations Workspace</h2>
      <p style="color: #64748b; margin: 0 0 20px 0; font-size: 14px;"><strong>${inviterName}</strong> has invited you to collaborate on <strong>${companyName}</strong> as a <strong>${role}</strong>.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
          Accept Invitation & Get Started
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Or access: <a href="${inviteUrl}">${inviteUrl}</a></p>
    </div>
  `;

  return sendEmail({ to, subject, html });
}
