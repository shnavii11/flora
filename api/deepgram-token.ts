// Vercel serverless function: hands the browser a Deepgram token for streaming.
//
// It first tries to mint a short-lived scoped token so the real key never
// reaches the browser. Some keys/plans cannot mint temp tokens (they get a 403
// "Insufficient permissions"); in that case it falls back to returning the raw
// key. That fallback is acceptable for a private personal deployment, but for a
// public URL you should enable temporary-token permissions on your Deepgram
// account so the raw key is never exposed.

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' })
  }

  try {
    const dgRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    })

    if (dgRes.ok) {
      const data = (await dgRes.json()) as { access_token?: string; key?: string }
      return res.status(200).json({ token: data.access_token || data.key, temporary: true })
    }

    // Fallback: key can't mint temp tokens. Return the raw key.
    const detail = await dgRes.text()
    console.warn('[Deepgram] grant failed, returning raw key:', dgRes.status, detail)
    return res.status(200).json({ token: apiKey, temporary: false })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
