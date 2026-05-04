// api/feedback.js
// Receives feedback form submissions and sends them via Resend email.

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract and trim form fields
    const { kind, email, subject, message } = req.body || {};
    const cleanKind = String(kind || 'general').trim().toLowerCase();
    const cleanEmail = String(email || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanMessage = String(message || '').trim();

    // Validate
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({ error: 'Please add at least 10 characters to your message.' });
    }
    if (cleanMessage.length > 5000) {
      return res.status(400).json({ error: 'Message is too long. Please keep it under 5000 characters.' });
    }

    // Whitelist allowed "kind" values to prevent garbage in subject lines
    const validKinds = ['general', 'bug', 'feature', 'billing', 'privacy', 'other'];
    const safeKind = validKinds.includes(cleanKind) ? cleanKind : 'general';

    // Build the email subject. If user provided a subject, use that, otherwise auto-generate from kind.
    const kindLabel = {
      general: 'General feedback',
      bug: 'Bug report',
      feature: 'Feature request',
      billing: 'Billing/account',
      privacy: 'Privacy question',
      other: 'Other'
    }[safeKind];
    const emailSubject = cleanSubject
      ? `[SurfShield ${kindLabel}] ${cleanSubject}`
      : `[SurfShield ${kindLabel}] from ${cleanEmail}`;

    // Build a simple HTML email body
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0d1b2a; margin-bottom: 8px;">New SurfShield feedback</h2>
        <p style="color: #7a95b0; margin-bottom: 24px; font-size: 14px;">Submitted via getsurfshield.com/feedback</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #7a95b0; width: 100px;">Type:</td>
            <td style="padding: 8px 0; color: #0d1b2a;"><strong>${escapeHtml(kindLabel)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #7a95b0;">From:</td>
            <td style="padding: 8px 0; color: #0d1b2a;"><a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></td>
          </tr>
          ${cleanSubject ? `
          <tr>
            <td style="padding: 8px 0; color: #7a95b0;">Subject:</td>
            <td style="padding: 8px 0; color: #0d1b2a;">${escapeHtml(cleanSubject)}</td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 24px; padding: 16px; background: #f5f8fa; border-left: 3px solid #00c2a8; border-radius: 4px;">
          <div style="color: #7a95b0; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Message</div>
          <div style="color: #0d1b2a; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(cleanMessage)}</div>
        </div>

        <p style="margin-top: 24px; color: #7a95b0; font-size: 12px;">
          Reply directly to this email to respond to the user.
        </p>
      </div>
    `;

    // Plain text fallback (some email clients don't render HTML)
    const textBody = [
      'New SurfShield feedback',
      'Submitted via getsurfshield.com/feedback',
      '',
      `Type: ${kindLabel}`,
      `From: ${cleanEmail}`,
      cleanSubject ? `Subject: ${cleanSubject}` : null,
      '',
      'Message:',
      cleanMessage,
      '',
      '---',
      'Reply directly to this email to respond to the user.'
    ].filter(Boolean).join('\n');

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SurfShield Feedback <noreply@getsurfshield.com>',
        to: ['feedback@getsurfshield.com'],
        reply_to: cleanEmail,
        subject: emailSubject,
        html: htmlBody,
        text: textBody
      })
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({}));
      console.error('Resend API error:', resendResponse.status, errorData);
      return res.status(502).json({
        error: 'Email service temporarily unavailable. Please email support@getsurfshield.com directly.'
      });
    }

    const resendData = await resendResponse.json();
    console.log('Feedback sent successfully. Resend ID:', resendData.id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Feedback handler error:', err);
    return res.status(500).json({
      error: 'Something went wrong on our end. Please try again or email support@getsurfshield.com directly.'
    });
  }
}

// Helper to escape user input before injecting into HTML
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
