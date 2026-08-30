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

    // 1. Try Sarvam High Quality TTS first
    try {
      const res = await fetch('/api/sarvam-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      })

      if (res.ok) {
        const data = (await res.json()) as { audioBase64?: string }
        if (data.audioBase64) {
          if (ctx) {
            try {
              const binaryStr = atob(data.audioBase64)
              const bytes = new Uint8Array(binaryStr.length)
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i)
              }

              const audioBuffer = await ctx.decodeAudioData(bytes.buffer)
              const source = ctx.createBufferSource()
              const gainNode = ctx.createGain()
              source.buffer = audioBuffer

              const now = ctx.currentTime
              gainNode.gain.setValueAtTime(0.01, now)
              gainNode.gain.exponentialRampToValueAtTime(1.0, now + 0.03)

              const duration = audioBuffer.duration
              gainNode.gain.setValueAtTime(1.0, now + duration - 0.05)
              gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration)

              source.connect(gainNode)
              gainNode.connect(ctx.destination)

              this.currentSource = source
              if (onStart) onStart()

              source.onended = () => {
                this.isSpeaking = false
                this.currentSource = null
                if (onEnd) onEnd()
              }

              source.start(0)
              return
            } catch {
              // Web Audio decode failed -> fallback below
            }
          }
        }
      }
    } catch {
      // Fetch failed -> fallback below
    }

    // 2. Reliable Web Speech Synthesis Fallback (ALWAYS works, no API key required)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.rate = 0.95
      utterance.pitch = 1.0

      // Select Hindi / natural voice if available
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
