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

  // Return the raw key so the browser authenticates the WebSocket with the
  // ['token', key] subprotocol — the exact path that worked in local testing.
  // (The temporary-token/['bearer', jwt] path did not transcribe on the live
  // Safari deployment; revert to raw key while we confirm the root cause.)
  return res.status(200).json({ token: apiKey, temporary: false })
}
