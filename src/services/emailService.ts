import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

interface SendInviteParams {
  recipientEmail: string;
  projectName: string;
  projectId: string;
}

interface SendInviteResult {
  success: boolean;
  message: string;
}

interface BatchInviteResult {
  success: boolean;
  results: {
    sent: string[];
    failed: { email: string; error: string }[];
  };
}

/**
 * Send a single project invitation email
 */
export const sendProjectInviteEmail = async (
  params: SendInviteParams
): Promise<SendInviteResult> => {
  try {
    const sendInvite = httpsCallable<SendInviteParams, SendInviteResult>(
      functions,
      'sendProjectInvite'
    );
    const result = await sendInvite(params);
    return result.data;
  } catch (error: unknown) {
    console.error('Error sending invite email:', error);
    // Don't throw - email is a nice-to-have, not critical
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
};

/**
 * Send batch project invitation emails
 */
export const sendProjectInviteEmailBatch = async (
  emails: string[],
  projectName: string,
  projectId: string
): Promise<BatchInviteResult> => {
  try {
    const sendBatch = httpsCallable<
      { emails: string[]; projectName: string; projectId: string },
      BatchInviteResult
    >(functions, 'sendProjectInviteBatch');

    const result = await sendBatch({ emails, projectName, projectId });
    return result.data;
  } catch (error: unknown) {
    console.error('Error sending batch invite emails:', error);
    // Don't throw - email is a nice-to-have, not critical
    return {
      success: false,
      results: {
        sent: [],
        failed: emails.map((email) => ({
          email,
          error: error instanceof Error ? error.message : 'Failed to send',
        })),
      },
    };
  }
};
