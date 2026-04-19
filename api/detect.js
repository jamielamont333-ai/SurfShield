export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, sensitivity } = req.body;

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
              text: 'Describe exactly what you see in this image. How many people are visible? Where are they positioned?'
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('FULL API RESPONSE:', JSON.stringify(data));
    
    const text = (data.content || []).map(i => i.text || '').join('');
    console.log('CLAUDE SAYS:', text);
    
    return res.status(200).json({ threat: false, reason: 'diagnostic', debug: text });

  } catch (e) {
    console.error('Error:', e.message);
    return res.status(200).json({ threat: false, reason: e.message });
  }
}
