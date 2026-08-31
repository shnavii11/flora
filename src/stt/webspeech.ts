// Speech-to-text using the browser's built-in Web Speech API
// (webkitSpeechRecognition in Safari/Chrome). Drop-in replacement for
// DeepgramSTTService — same start/pause/resume/stop contract — so main.ts's
// TTS pause logic keeps working unchanged.
//
// Why: Deepgram's browser WebSocket refused to authenticate on the live Safari
// deployment (audio reached the app fine — the visualizer reacted — but the
// socket never produced transcripts). The native recognizer needs no key, no
// socket, and no server round-trip, and it handles the mic itself.

export type TranscriptHandler = (transcript: string) => void

interface SpeechAlt {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechAlt
  length: number
}
interface SpeechResultList {
  length: number
  [index: number]: SpeechResult
}
interface SpeechEvent {
  resultIndex: number
  results: SpeechResultList
}
interface SpeechErrorEvent {
  error: string
}
interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onresult: ((e: SpeechEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}
interface WindowWithSpeech {
  SpeechRecognition?: new () => SpeechRecognizer
  webkitSpeechRecognition?: new () => SpeechRecognizer
}

// Preferred recognition language, with fallbacks if the device lacks Hindi
// dictation. The counselor speaks Hindi, but users often mix in English.
const LANG_CHAIN = ['hi-IN', 'en-IN', 'en-US']

export class WebSpeechSTTService {
  private recognition: SpeechRecognizer | null = null
  private onTranscript: TranscriptHandler | null = null
  private onInterim: TranscriptHandler | null = null
  private isListening = false
  private isPaused = false
  private isRunning = false // recognition actually active (guards double start())
  private langIndex = 0
  private finalBuffer = ''
  private interimText = '' // latest not-yet-finalized words, committed on VAD endpoint
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  // Signature mirrors DeepgramSTTService; stream + audioContext are ignored
  // because the Web Speech API captures the mic on its own.
  async start(
    _stream: MediaStream,
    _audioContext: AudioContext | null,
    onTranscript: TranscriptHandler,
    onInterim?: TranscriptHandler
  ) {
    const win = window as WindowWithSpeech
    const Recognizer = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!Recognizer) {
      console.error('[WebSpeech] SpeechRecognition not supported in this browser')
      return
    }

    this.onTranscript = onTranscript
    this.onInterim = onInterim || null
    this.isListening = true
    this.isPaused = false

    const rec = new Recognizer()
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.lang = LANG_CHAIN[this.langIndex]

    rec.onstart = () => {
      this.isRunning = true
    }

    rec.onresult = (e: SpeechEvent) => {
      if (this.isPaused) return
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const txt = r[0]?.transcript || ''
        if (r.isFinal) final += txt
        else interim += txt
      }

      this.interimText = interim
      if (interim && this.onInterim) {
        this.onInterim((this.finalBuffer + ' ' + interim).trim())
      }
      if (final.trim()) {
        this.finalBuffer = (this.finalBuffer + ' ' + final).trim()
        this.interimText = ''
        this.flush()
      }
    }

    rec.onerror = (e: SpeechErrorEvent) => {
      // 'no-speech' / 'aborted' are normal; onend will restart.
      if (e.error === 'language-not-supported' && this.langIndex < LANG_CHAIN.length - 1) {
        this.langIndex++
        console.warn('[WebSpeech] language not supported, falling back to', LANG_CHAIN[this.langIndex])
      } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        console.error('[WebSpeech] microphone/speech permission denied')
        this.isListening = false
      }
    }

    rec.onend = () => {
      this.isRunning = false
      // Safari ends recognition after each pause/utterance; keep it alive by
      // restarting whenever we're still supposed to be listening.
      if (this.isListening && !this.isPaused) this.scheduleRestart()
    }

    this.recognition = rec
    this.safeStart()
  }

  private safeStart() {
    if (!this.recognition || this.isRunning) return
    if (this.recognition.lang !== LANG_CHAIN[this.langIndex]) {
      this.recognition.lang = LANG_CHAIN[this.langIndex]
    }
    try {
      this.recognition.start()
    } catch {
      // InvalidStateError if already started — ignore.
    }
  }

  private scheduleRestart() {
    if (this.restartTimer) return
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (this.isListening && !this.isPaused) this.safeStart()
    }, 250)
  }

  /**
   * Called from the app's VAD loop the moment the user stops talking. Commits
   * whatever has been recognized so far (final + interim) instead of waiting for
   * Safari to mark the result final — which can lag several seconds.
   */
  commitFromVAD() {
    if (this.isPaused || !this.isListening) return
    const combined = (this.finalBuffer + ' ' + this.interimText).trim()
    if (!combined) return
    this.finalBuffer = combined
    this.interimText = ''
    this.flush()
  }

  private flush() {
    const transcript = this.finalBuffer.trim()
    this.finalBuffer = ''
    this.interimText = ''
    if (transcript && !this.isPaused && this.onTranscript) {
      // Mirror old behavior: stop listening while the reply is fetched & spoken.
      this.pause()
      this.onTranscript(transcript)
    }
  }

  pause() {
    this.isPaused = true
    this.finalBuffer = ''
    this.interimText = ''
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop()
      } catch {}
    }
  }

  resume() {
    this.isPaused = false
    this.finalBuffer = ''
    if (!this.isListening) return
    this.safeStart()
  }

  stop() {
    this.isListening = false
    this.isPaused = false
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.recognition) {
      this.recognition.onend = null
      this.recognition.onresult = null
      this.recognition.onerror = null
      try {
        this.recognition.abort()
      } catch {}
    }
    this.recognition = null
    this.isRunning = false
  }
}
