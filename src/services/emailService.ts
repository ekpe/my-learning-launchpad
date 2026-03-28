export interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (params: EmailParams) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send email');
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    // We don't want to break the app if email fails
    return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
};
