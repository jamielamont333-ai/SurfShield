export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Analyze this webcam image for a screen privacy app. Sensitivity level: ${sens}/10 (higher = more sensitive).

Count all people visible. The PRIMARY user sits directly in front of the camera. A VIEWER is any additional person visible anywhere in the frame.

Respond ONLY with valid JSON, no markdown, no explanation:
{"threat": boolean, "count": number, "reason": "short string"}

threat=true if: (sensitivity>=7 and count>=2) OR (sensitivity<7 and count>=3) OR any person is clearly looking over a shoulder at a screen.
reason should be brief e.g. "Viewer detected on left" or "Clear" or "Multiple people nearby".`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).map(i => i.text || '').join('').trim();
    console.log('CLAUDE SAYS:', text);

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({
      threat: !!parsed.threat,
      reason: parsed.reason || 'OK',
      count: parsed.count || 0
    });

  } catch (e) {
    console.error('Error:', e.message);
    return res.status(200).json({ threat: false, reason: e.message });
  }
}
