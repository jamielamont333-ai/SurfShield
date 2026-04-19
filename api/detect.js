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
        model: 'claude-sonnet-4-20250514',
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
              text: `You are a privacy protection system. Analyze this webcam image carefully.

Count the number of human faces or people visible in this image.

A THREAT exists if ANY of these are true:
- More than one face is visible
- Someone appears to be looking over the primary user's shoulder
- A person is visible in the background
- Any part of a second person is visible (even partial face, head, or body)

Sensitivity level is ${sensitivity} out of 5. At level ${sensitivity}:
${sensitivity >= 4 ? '- Be very sensitive, flag even partial or distant faces' : ''}
${sensitivity === 3 ? '- Flag any clear second person visible' : ''}
${sensitivity <= 2 ? '- Only flag if a second person is clearly and obviously present' : ''}

Reply ONLY with this exact JSON format, nothing else:
{"threat": true or false, "faces": number of faces seen, "reason": "brief description under 6 words"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('Claude API error:', data.error);
      return res.status(200).json({ threat: false, reason: 'api error' });
    }
    
    const raw = (data.content || []).map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(raw);
    } catch(e) {
      console.error('Parse error:', raw);
      return res.status(200).json({ threat: false, reason: 'parse error' });
    }
    
    console.log('Detection result:', result);
    return res.status(200).json(result);

  } catch (e) {
    console.error('Detection error:', e);
    return res.status(500).json({ threat: false, reason: 'server error' });
  }
}
