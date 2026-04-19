export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, sensitivity } = req.body;
    const sens = parseInt(sensitivity) || 3;

    const prompt = `You are a privacy protection system. Look at this webcam image and count human faces.

Reply ONLY with valid JSON like this: {"threat":false,"faces":1,"reason":"only one person"}

Set threat to true if you see more than one face or person. Set threat to false if only one person is visible.
Sensitivity is ${sens}/5. At sensitivity 4-5, flag even partial faces in background.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('Claude error:', JSON.stringify(data.error));
      return res.status(200).json({ threat: false, reason: 'api error' });
    }

    const raw = (data.content || []).map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    console.log('Claude response:', raw);
    
    const result = JSON.parse(raw);
    return res.status(200).json(result);

  } catch (e) {
    console.error('Error:', e.message);
    return res.status(200).json({ threat: false, reason: 'error' });
  }
}
