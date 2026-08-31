import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, history } = (req.body || {}) as { text?: string; history?: ChatMessage[] }
  if (!text) {
    return res.status(400).json({ error: 'Missing text in request body' })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return res.status(200).json({
      adviceText: 'मैं आपकी बात पूरे दिल से सुन रही हूँ। इस समय आपको सबसे ज़्यादा क्या परेशान कर रहा है?',
      confidenceScore: 0.3,
      emotionalState: 'stressed',
    })
  }

  try {
    let historyContext = ''
    if (history && history.length > 0) {
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
3. Keep it very brief: 1-2 short, soothing sentences only (a quick reflection plus the follow-up question). DO NOT use Markdown, asterisks (*), hashtags (#), or special characters.
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`
    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: 160,
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
    })

    // Retry transient failures (429 / 5xx) so the user gets a real, contextual
    // reply instead of a generic fallback line.
    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      })
      if (response.ok) break
      if (![429, 500, 502, 503, 504].includes(response.status)) break
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }

    if (!response || !response.ok) {
      return res.status(200).json({
        adviceText: 'आपकी भावनाएँ यहाँ पूरी तरह से सुरक्षित हैं। इस समय आपको किस बात से शांति मिलेगी?',
        confidenceScore: 0.4,
        emotionalState: 'venting',
      })
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

    try {
      const parsed = JSON.parse(rawContent) as { adviceText?: string; confidenceScore?: number; emotionalState?: string }
      const cleanAdvice = (parsed.adviceText || '').replace(/[*#_~`]/g, '').trim() ||
        'याद रखें कि आपको सब कुछ अकेले नहीं संभालना है। आज हम मिलकर क्या हल्का कर सकते हैं?'
      const score = typeof parsed.confidenceScore === 'number' ? Math.min(Math.max(parsed.confidenceScore, 0.1), 1.0) : 0.5
      return res.status(200).json({ adviceText: cleanAdvice, confidenceScore: score, emotionalState: parsed.emotionalState || 'consoling' })
    } catch {
      const cleanAdvice = rawContent.replace(/[*#_~`]/g, '').trim() ||
        'याद रखें कि आपको सब कुछ अकेले नहीं संभालना है। आज हम मिलकर क्या हल्का कर सकते हैं?'
      return res.status(200).json({ adviceText: cleanAdvice, confidenceScore: 0.5, emotionalState: 'consoling' })
    }
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
