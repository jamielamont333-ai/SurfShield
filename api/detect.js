export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, sensitivity } = req.body;

    const note = sensitivity <= 2
      ? 'Only flag if clearly a second person.'
      : sensitivity >= 4
      ? 'Flag even partial or angled faces.'
      : 'Use moderate judgment.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: `Privacy scan. ${note} Reply ONLY with valid JSON: {"threat":true or false,"reason":"max 5 words"}. Threat = second person, someone looking over shoulder.` }
          ]
        }]
      })
    });

    const data = await response.json();
    const raw = (data.content || []).map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    return res.status(200).json(result);

  } catch (e) {
    console.error('Detection error:', e);
    return res.status(500).json({ threat: false, reason: 'scan error' });
  }
}
