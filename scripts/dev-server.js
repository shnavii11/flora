import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env')

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  })
}

const PORT = process.env.API_PORT || 3011

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  let bodyText = ''
  req.on('data', (chunk) => {
    bodyText += chunk
  })

  req.on('end', async () => {
    let body = {}
    try {
      if (bodyText) body = JSON.parse(bodyText)
    } catch {}

    const url = req.url || '/'

    // 1. /api/counselor Endpoint (Psychological Perspective & Devanagari Hindi)
    if (url === '/api/counselor' && req.method === 'POST') {
      const { text, history } = body
      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Missing text in request body' }))
      }

      const googleKey = process.env.GOOGLE_API_KEY
      if (!googleKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(
          JSON.stringify({
            adviceText:
              'मैं आपकी बात पूरे दिल से सुन रही हूँ। इस समय आपको सबसे ज़्यादा क्या परेशान कर रहा है?',
            confidenceScore: 0.3,
            emotionalState: 'stressed',
          })
        )
      }

      try {
        let historyContext = ''
        if (history && Array.isArray(history) && history.length > 0) {
          historyContext = history
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'उपयोगकर्ता' : 'काउंसलर ट्री'}: ${h.text}`)
            .join('\n')
        }

        const systemPrompt = `You are HarmonicFlora, a warm, wise, deeply empathetic AI voice counselor tree.
Perform a psychological perspective analysis of the user's thoughts.
CRITICAL MANDATES:
1. DIRECTLY respond to what the user just said. Briefly reflect their specific situation or feeling (in Hindi, in your own gentle words) so they feel genuinely heard, THEN comfort them. Never reply with generic lines that ignore their actual message.
2. Respond ONLY IN HINDI (Devanagari script, हिन्दी भाषा). NEVER output any English words, letters, or Roman characters.
3. Write 2-3 short, soothing sentences. DO NOT use Markdown, asterisks (*), hashtags (#), or special characters.
4. ALWAYS end with a gentle, caring follow-up question in Hindi that clearly relates to what they just shared.
5. Output your response as a valid JSON object:
{
  "adviceText": "hindi response text here",
  "confidenceScore": 0.65,
  "emotionalState": "healing"
}
Where confidenceScore is a float between 0.0 (high stress/vulnerability) and 1.0 (full emotional relief/peace).`

        const fullPrompt = `${systemPrompt}\n\n${historyContext ? `पिछली बातचीत:\n${historyContext}\n\n` : ''}उपयोगकर्ता का विचार: "${text}"`

        // flash-lite: higher free-tier rate limit + lower latency, and it doesn't
        // waste the token budget on "thinking" the way gemini-flash-latest does.
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${googleKey}`
        const geminiBody = JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 0.35,
            responseMimeType: 'application/json',
          },
        })

        // Retry transient failures (429 rate-limit / 5xx) so the user gets a
        // real, contextual reply instead of a generic fallback line.
        let geminiRes = null
        for (let attempt = 0; attempt < 3; attempt++) {
          geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: geminiBody,
          })
          if (geminiRes.ok) break
          if (![429, 500, 502, 503, 504].includes(geminiRes.status)) break
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }

        if (!geminiRes || !geminiRes.ok) {
          console.warn('[Gemini] failed after retries:', geminiRes && geminiRes.status)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(
            JSON.stringify({
              adviceText:
                'आपकी भावनाएँ यहाँ पूरी तरह से सुरक्षित हैं। इस समय आपको किस बात से शांति मिलेगी?',
              confidenceScore: 0.4,
              emotionalState: 'venting',
            })
          )
        }

        const data = await geminiRes.json()
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

        try {
          const parsed = JSON.parse(rawContent)
          const cleanAdvice = (parsed.adviceText || '').replace(/[*#_~`]/g, '').trim() ||
            'याद रखें कि आपको सब कुछ अकेले नहीं संभालना है। आज हम मिलकर क्या हल्का कर सकते हैं?'
          const score = typeof parsed.confidenceScore === 'number' ? Math.min(Math.max(parsed.confidenceScore, 0.1), 1.0) : 0.5
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ adviceText: cleanAdvice, confidenceScore: score, emotionalState: parsed.emotionalState || 'consoling' }))
        } catch {
          const cleanAdvice = rawContent.replace(/[*#_~`]/g, '').trim() ||
            'याद रखें कि आपको सब कुछ अकेले नहीं संभालना है। आज हम मिलकर क्या हल्का कर सकते हैं?'
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ adviceText: cleanAdvice, confidenceScore: 0.5, emotionalState: 'consoling' }))
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // 2. /api/sarvam-tts Endpoint (hi-IN Sarvam BulBul v3 Low Latency)
    if (url === '/api/sarvam-tts' && req.method === 'POST') {
      const { text, language } = body
      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Missing text' }))
      }

      const sarvamKey = process.env.SARVAM_API_KEY
      if (!sarvamKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'SARVAM_API_KEY not configured' }))
      }

      try {
        const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'api-subscription-key': sarvamKey,
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
          console.error('[Sarvam Error]', sarvamRes.status, errDetail)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Sarvam API error', detail: errDetail }))
        }

        const data = await sarvamRes.json()
        const audioBase64 = data.audios?.[0] || ''
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ audioBase64 }))
      } catch (err) {
        console.error('[TTS Server Error]', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // 3. /api/deepgram-token Endpoint (mints a short-lived token so the real
    //    Deepgram key never reaches the browser)
    if (url === '/api/deepgram-token' && req.method === 'POST') {
      const deepgramKey = process.env.DEEPGRAM_API_KEY
      if (!deepgramKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }))
      }

      try {
        // Prefer a short-lived scoped token so the raw key never hits the browser.
        const dgRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
          method: 'POST',
          headers: {
            Authorization: `Token ${deepgramKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl_seconds: 30 }),
        })

        if (dgRes.ok) {
          const data = await dgRes.json()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ token: data.access_token || data.key, temporary: true }))
        }

        // Fallback (LOCAL DEV ONLY): some keys/plans can't mint temp tokens.
        // Hand back the raw key — acceptable over localhost, never in production.
        const detail = await dgRes.text()
        console.warn('[Deepgram] grant failed, using raw key for local dev:', dgRes.status, detail)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ token: deepgramKey, temporary: false }))
      } catch (err) {
        console.error('[Deepgram Token Server Error]', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })
})

server.listen(PORT, () => {
  console.log(`[API Backend] Server listening on http://localhost:${PORT}`)
})
