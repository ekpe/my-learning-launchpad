import { auth } from '../firebase';

export interface EmailParams {
  // 'self' — an account-notification email to the signed-in user's own
  // verified address; the server ignores `to` and requires a valid session.
  // 'public' — a public-form email (contact, lead magnet) to an address a
  // logged-out visitor typed in; validated and rate-limited server-side.
  context: 'self' | 'public';
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (params: EmailParams) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.context === 'self') {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');
      headers.Authorization = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response received:', text);
      throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};
