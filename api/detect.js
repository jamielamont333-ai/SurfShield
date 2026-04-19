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
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Analyze this webcam image for a screen privacy app. Sensitivity level: ${sens}/10.

Look carefully for:
1. How many people are visible in the frame?
2. Is anyone positioned to the side or behind the primary user?
3. Is anyone glancing, looking, or angling their eyes toward the screen?

Respond ONLY with raw JSON, no markdown, no backticks, no explanation.

If only the primary user is visible and no one is looking at the screen:
{"threat": false, "count": 1, "reason": "Only user visible"}

If NO person is visible at all:
{"threat": false, "count": 0, "reason": "No people visible"}

If ANY of these are true:
- A second person is visible anywhere in the frame
- Someone is positioned to the side or behind the user
- Someone appears to be glancing or looking toward the screen
- At sensitivity 7+ even a partial face or body is visible nearby
Then respond:
{"threat": true, "count": 2, "reason": "Brief description of what you see e.g. Person glancing from left"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).map(i => i.text || '').join('').trim();
    console.log('CLAUDE SAYS:', text);

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