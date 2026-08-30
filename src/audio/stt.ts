interface SpeechRecognitionResult {
  readonly length: number
  [index: number]: { readonly [index: number]: { readonly transcript: string } }
}

interface SpeechRecognitionEvent {
  readonly results: SpeechRecognitionResult
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (event: SpeechRecognitionEvent) => void
  onend: () => void
  onerror: (event: unknown) => void
  start: () => void
  stop: () => void
}

export class SpeechToTextService {
  private recognition: SpeechRecognitionInstance | null = null
  private isListening = false
  private isPaused = false
  private onTranscriptCallback: ((text: string) => void) | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (SpeechRecognition && typeof SpeechRecognition === 'function') {
      this.recognition = new (SpeechRecognition as new () => SpeechRecognitionInstance)()
      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = 'hi-IN'

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (this.isPaused) return
        if (event.results && event.results[0] && event.results[0][0]) {
          const transcript = event.results[0][0].transcript.trim()
          if (transcript && this.onTranscriptCallback) {
            this.pause() // Pause listening while processing & speaking
            this.onTranscriptCallback(transcript)
          }
        }
      }

      this.recognition.onerror = () => {
        // Automatically attempt restart on recoverable error if still listening
        if (this.isListening && !this.isPaused) {
          this.scheduleRestart(300)
        }
      }

      this.recognition.onend = () => {
        if (this.isListening && !this.isPaused) {
          this.scheduleRestart(200)
        }
      }
    }
  }

  private scheduleRestart(delayMs: number) {
    setTimeout(() => {
      if (this.isListening && !this.isPaused && this.recognition) {
        try {
          this.recognition.start()
        } catch {}
      }
    }, delayMs)
  }

  start(onTranscript: (text: string) => void) {
    this.onTranscriptCallback = onTranscript
    this.isListening = true
    this.isPaused = false
    if (this.recognition) {
      try {
        this.recognition.start()
      } catch {}
    }
  }

  pause() {
    this.isPaused = true
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)

    // Watchdog: If resume() is not called within 14s, auto-resume so listening never deadlocks
    this.watchdogTimer = setTimeout(() => {
      if (this.isListening && this.isPaused) {
        this.resume()
      }
    }, 14000)

    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
    }
  }

  resume() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
    this.isPaused = false
    if (this.isListening && this.recognition) {
      this.scheduleRestart(150)
    }
  }

  stop() {
    this.isListening = false
    this.isPaused = false
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
    }
  }
}
