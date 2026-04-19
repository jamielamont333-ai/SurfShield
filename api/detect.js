export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
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
}