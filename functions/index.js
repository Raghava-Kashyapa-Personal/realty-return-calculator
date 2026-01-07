const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

/**
 * Generate HTML email for project invitation
 */
const generateInviteEmailHTML = ({ projectName, inviterName, inviterEmail, appUrl }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">You've Been Invited!</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          <strong>${inviterName || inviterEmail}</strong> has invited you to collaborate on a project in Finance Calculator.
        </p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0; color: #667eea; font-size: 18px;">Project: ${projectName}</h2>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Sign in to view and collaborate on this project.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Open Finance Calculator
          </a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          If you don't have an account yet, you can sign up using Google or create an account with this email address.
          Once you sign in, you'll automatically have access to the shared project.
        </p>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          This invitation was sent by ${inviterEmail}.<br>
          If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send project invitation email via SendGrid
 */
exports.sendProjectInvite = onCall(
  {
    secrets: [sendgridApiKey],
    cors: true
  },
  async (request) => {
    const { auth, data } = request;

    if (!auth) {
      throw new Error('Authentication required');
    }

    const { recipientEmail, projectName, projectId } = data;

    if (!recipientEmail || !projectName) {
      throw new Error('recipientEmail and projectName are required');
    }

    try {
      // Get inviter info
      const inviterRecord = await admin.auth().getUser(auth.uid);
      const inviterName = inviterRecord.displayName || '';
      const inviterEmail = inviterRecord.email || '';

      // Configure SendGrid
      sgMail.setApiKey(sendgridApiKey.value());

      // App URL - you can make this configurable
      const appUrl = 'https://finance-app-5e1cc.web.app';

      // Generate email HTML
      const htmlContent = generateInviteEmailHTML({
        projectName,
        inviterName,
        inviterEmail,
        appUrl
      });

      // Prepare email message
      const msg = {
        to: recipientEmail,
        from: 'info@qualitastech.com', // Verified in SendGrid
        subject: `${inviterName || inviterEmail} invited you to "${projectName}" on Finance Calculator`,
        html: htmlContent,
        text: `${inviterName || inviterEmail} has invited you to collaborate on "${projectName}" in Finance Calculator. Sign in at ${appUrl} to access the project.`,
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false
          }
        }
      };

      // Send email
      await sgMail.send(msg);

      console.log('Project invite sent', {
        to: recipientEmail,
        projectId,
        invitedBy: auth.uid
      });

      return {
        success: true,
        message: `Invitation sent to ${recipientEmail}`
      };

    } catch (error) {
      console.error('Failed to send project invite', {
        error: error.message,
        recipientEmail,
        projectId
      });

      throw new Error(`Failed to send invitation: ${error.message}`);
    }
  }
);

/**
 * Send batch invitations for multiple emails
 */
exports.sendProjectInviteBatch = onCall(
  {
    secrets: [sendgridApiKey],
    cors: true
  },
  async (request) => {
    const { auth, data } = request;

    if (!auth) {
      throw new Error('Authentication required');
    }

    const { emails, projectName, projectId } = data;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error('emails array is required');
    }

    if (!projectName) {
      throw new Error('projectName is required');
    }

    try {
      // Get inviter info
      const inviterRecord = await admin.auth().getUser(auth.uid);
      const inviterName = inviterRecord.displayName || '';
      const inviterEmail = inviterRecord.email || '';

      // Configure SendGrid
      sgMail.setApiKey(sendgridApiKey.value());

      const appUrl = 'https://finance-app-5e1cc.web.app';

      const results = {
        sent: [],
        failed: []
      };

      // Send to each email
      for (const recipientEmail of emails) {
        try {
          const htmlContent = generateInviteEmailHTML({
            projectName,
            inviterName,
            inviterEmail,
            appUrl
          });

          const msg = {
            to: recipientEmail,
            from: 'info@qualitastech.com',
            subject: `${inviterName || inviterEmail} invited you to "${projectName}" on Finance Calculator`,
            html: htmlContent,
            text: `${inviterName || inviterEmail} has invited you to collaborate on "${projectName}" in Finance Calculator. Sign in at ${appUrl} to access the project.`,
            trackingSettings: {
              clickTracking: { enable: false, enableText: false }
            }
          };

          await sgMail.send(msg);
          results.sent.push(recipientEmail);

        } catch (error) {
          console.error(`Failed to send to ${recipientEmail}:`, error.message);
          results.failed.push({ email: recipientEmail, error: error.message });
        }
      }

      console.log('Batch invites completed', {
        projectId,
        sent: results.sent.length,
        failed: results.failed.length
      });

      return {
        success: true,
        results
      };

    } catch (error) {
      console.error('Batch invite failed', { error: error.message });
      throw new Error(`Failed to send invitations: ${error.message}`);
    }
  }
);
