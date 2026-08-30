import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, language } = (req.body || {}) as { text?: string; language?: string }
  if (!text) {
    return res.status(400).json({ error: 'Missing text in request body' })
  }

  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'SARVAM_API_KEY not configured' })
  }

  try {
    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: language || 'hi-IN',
        speaker: 'ritu',
        pace: 1.05,
        enable_preprocessing: false,
        model: 'bulbul:v3',
      }),
    })

    if (!sarvamRes.ok) {
      const errDetail = await sarvamRes.text()
      return res.status(502).json({ error: 'Sarvam API error', detail: errDetail })
    }

    const data = (await sarvamRes.json()) as { audios?: string[] }
    const audioBase64 = data.audios?.[0] || ''
    return res.status(200).json({ audioBase64 })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
