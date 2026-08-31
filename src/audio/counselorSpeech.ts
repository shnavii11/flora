interface WindowWithWebkitAudio {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export class CounselorSpeechService {
  private isSpeaking = false
  private audioCtx: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null

  initAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      const win = window as WindowWithWebkitAudio
      const AudioCtxClass = win.AudioContext || win.webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
    return this.audioCtx
  }

  stopSpeech() {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {}
      this.currentSource = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
  }

  // Split into sentences on Devanagari and Latin terminators. No lookbehind
  // (older Safari lacks it) — match runs of text plus their trailing punctuation.
  private splitSentences(text: string): string[] {
    const parts = text.match(/[^।॥?!.\n]+[।॥?!.\n]*/g) || [text]
    return parts.map((s) => s.trim()).filter((s) => s.length > 0)
  }

  private async synthesize(sentence: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    try {
      const res = await fetch('/api/sarvam-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { audioBase64?: string }
      if (!data.audioBase64) return null
      const binaryStr = atob(data.audioBase64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      return await ctx.decodeAudioData(bytes.buffer)
    } catch {
      return null
    }
  }

  private playBuffer(buffer: AudioBuffer, ctx: AudioContext): Promise<void> {
    return new Promise((resolve) => {
      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      source.buffer = buffer

      const now = ctx.currentTime
      const dur = buffer.duration
      // Tiny fades at the edges of each chunk prevent clicks between sentences.
      gainNode.gain.setValueAtTime(0.01, now)
      gainNode.gain.exponentialRampToValueAtTime(1.0, now + 0.02)
      gainNode.gain.setValueAtTime(1.0, now + Math.max(dur - 0.03, 0.03))
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + dur)

      source.connect(gainNode)
      gainNode.connect(ctx.destination)

      this.currentSource = source
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null
        resolve()
      }
      source.start(0)
    })
  }

  async speakAdvice(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
    this.stopSpeech()
    this.isSpeaking = true

    // Remove emojis, asterisks, hashtags, and markdown characters
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*#_~`]/g, '')
      .trim()

    if (!cleanText) {
      this.isSpeaking = false
      if (onEnd) onEnd()
      return
    }

    const ctx = this.initAudioContext()

    // 1. Sarvam HQ TTS, sentence-chunked. Fire all syntheses in parallel and
    //    play them in order — the first sentence speaks as soon as it's ready
    //    while the rest are still generating, so there's almost no dead air.
    if (ctx) {
      const sentences = this.splitSentences(cleanText)
      const bufferPromises = sentences.map((s) => this.synthesize(s, ctx))
      let started = false

      for (let i = 0; i < bufferPromises.length; i++) {
        if (!this.isSpeaking) break // stopped / barge-in
        const buffer = await bufferPromises[i]
        if (!this.isSpeaking) break
        if (!buffer) {
          // First chunk failed and nothing has played -> use Web Speech fallback.
          if (!started) break
          continue // a later chunk failed; skip it rather than aborting.
        }
        if (!started) {
          started = true
          if (onStart) onStart()
        }
        await this.playBuffer(buffer, ctx)
      }

      if (started) {
        this.isSpeaking = false
        this.currentSource = null
        if (onEnd) onEnd()
        return
      }
      // started === false: nothing played (all syntheses failed) -> fall through.
    }

    // 2. Reliable Web Speech Synthesis fallback (no API key required).
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.rate = 0.95
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const hiVoice = voices.find((v) => v.lang.startsWith('hi') || v.name.includes('Hindi'))
      if (hiVoice) {
        utterance.voice = hiVoice
        utterance.lang = 'hi-IN'
      }

      if (onStart) onStart()

      utterance.onend = () => {
        this.isSpeaking = false
        if (onEnd) onEnd()
      }
      utterance.onerror = () => {
        this.isSpeaking = false
        if (onEnd) onEnd()
      }

      window.speechSynthesis.speak(utterance)
      return
    }

    this.isSpeaking = false
    if (onEnd) onEnd()
  }

  getSpeakingState() {
    return this.isSpeaking
  }
}
