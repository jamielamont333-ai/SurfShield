module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ================================================================
  //  M5 GATE — only requests with a valid license key may proceed
  // ================================================================

  // Step 1: Read the license key from the X-License-Key header.
  // The desktop app and Chrome extension attach this on every call.
  // We trim whitespace and uppercase it so common copy-paste mistakes
  // (trailing space, lowercased letters) don't lock out paying users.
  const licenseKey = (req.headers['x-license-key'] || '').trim().toUpperCase();

  if (!licenseKey) {
    return res.status(401).json({
      error: 'license_key_missing',
      message: 'No license key was provided.'
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

  // Step 2: One round-trip to Supabase that returns both the license row
  // AND the linked subscription row, using PostgREST resource embedding.
  try {
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?license_key=eq.${encodeURIComponent(licenseKey)}&select=id,is_active,subscription:subscriptions(status)&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'apikey': SUPABASE_SECRET_KEY
        }
      }
    );

    const rows = await lookupRes.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({
        error: 'license_invalid',
        message: 'License key not recognized.'
      });
    }

    const license = rows[0];

    // Belt: license itself must be active
    if (!license.is_active) {
      return res.status(402).json({
        error: 'license_inactive',
        message: 'This license has been deactivated.'
      });
    }

    // Suspenders: linked subscription must be in a paid-access state.
    // 'active'   = paying customer
    // 'trialing' = in their 7-day free trial
    // Both should have full access.
    const subStatus = license.subscription && license.subscription.status;
    const validStatuses = ['active', 'trialing', 'past due'];
    if (!validStatuses.includes(subStatus)) {
      return res.status(402).json({
        error: 'subscription_inactive',
        message: 'No active subscription on this license. Renew to continue.'
      });
    }
  } catch (err) {
    console.error('License check failed:', err.message);
    return res.status(503).json({
      error: 'license_check_failed',
      message: 'Could not verify your license. Try again in a moment.'
    });
  }

  // ================================================================
  //  Gate passed — original Claude detection logic, unchanged
  // ================================================================

  try {
    const { image, sensitivity } = req.body;
    const sens = parseInt(sensitivity) || 5;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: 'You are a JSON-only API. You must respond with a single valid JSON object and nothing else. No markdown, no backticks, no explanation, no preamble. Only output the JSON object.',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Look at this webcam image. Sensitivity: ${sens}/10.
Count people visible. Check if anyone is glancing at the screen.
Respond with exactly one of these JSON objects:
{"threat":false,"count":0,"reason":"No people visible"}
{"threat":false,"count":1,"reason":"Only user visible"}
{"threat":true,"count":2,"reason":"[describe what you see]"}`
            }
          ]
        }]
      })
    });
    const data = await response.json();
    const text = (data.content || []).map(i => i.text || '').join('').trim();
    console.log('CLAUDE SAYS FULL:', JSON.stringify(data));
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error('No JSON: ' + clean.substring(0, 50));
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
      threat: !!parsed.threat,
      reason: parsed.reason || 'OK',
      count: parsed.count || 0
    });
  } catch (e) {
    console.error('Error:', e.message);
    return res.status(200).json({ threat: false, reason: e.message });
  }
};
