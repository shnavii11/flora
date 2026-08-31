// Streams mic audio to Deepgram over a WebSocket and emits final transcripts.
// Replaces the browser-only webkitSpeechRecognition path so STT works in
// Safari, Chrome, Edge and Firefox alike, with lower latency (interim streaming).
//
// Audio is captured as raw PCM off the Web Audio graph and sent as linear16.
// (MediaRecorder was avoided on purpose: Safari only emits non-fragmented mp4,
// whose mid-stream chunks Deepgram can't decode. Raw PCM works everywhere.)

export type TranscriptHandler = (transcript: string) => void

interface WindowWithWebkitAudio {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

/**
 * Drop-in replacement for SpeechToTextService. Same lifecycle contract
 * (start / pause / resume / stop) so main.ts's TTS pause logic keeps working.
 */
export class DeepgramSTTService {
  private ws: WebSocket | null = null
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private providedCtx: AudioContext | null = null
  private ownsCtx = false
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private mute: GainNode | null = null
  private onTranscript: TranscriptHandler | null = null
  private onInterim: TranscriptHandler | null = null
  private isListening = false
  private isPaused = false
  private finalBuffer = ''
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async start(
    stream: MediaStream,
    audioContext: AudioContext | null,
    onTranscript: TranscriptHandler,
    onInterim?: TranscriptHandler
  ) {
    this.stream = stream
    // Reuse the mic's already-running AudioContext. Safari suspends any new
    // AudioContext created outside a user gesture (i.e. after the awaits in the
    // startup flow), which silently stops ScriptProcessor from emitting audio —
    // so a fresh context would send Deepgram nothing. The mic context is already
    // resumed (it drives the live visualizer), so PCM actually flows.
    this.providedCtx = audioContext
    this.onTranscript = onTranscript
    this.onInterim = onInterim || null
    this.isListening = true
    this.isPaused = false
    this.setupAudioGraph()
    await this.connect()
  }

  private setupAudioGraph() {
    if (this.audioCtx || !this.stream) return

    let ctx = this.providedCtx
    if (!ctx) {
      const win = window as WindowWithWebkitAudio
      const AudioCtxClass = win.AudioContext || win.webkitAudioContext
      if (!AudioCtxClass) return
      ctx = new AudioCtxClass()
      this.ownsCtx = true
    }
    const source = ctx.createMediaStreamSource(this.stream)
    // ScriptProcessor is deprecated but universally supported (incl. Safari) and
    // needs no separate worklet module — ideal for simple PCM capture.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    // Route through a silent gain so the node runs without echoing the mic.
    const mute = ctx.createGain()
    mute.gain.value = 0

    processor.onaudioprocess = (e) => {
      if (this.isPaused || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      this.ws.send(pcm.buffer)
    }

    source.connect(processor)
    processor.connect(mute)
    mute.connect(ctx.destination)

    this.audioCtx = ctx
    this.source = source
    this.processor = processor
    this.mute = mute
  }

  private dgQuery(): string {
    // Native sample rate — no downsampling needed; Deepgram accepts linear16 @ any rate.
    const rate = this.audioCtx ? Math.round(this.audioCtx.sampleRate) : 48000
    return new URLSearchParams({
      // nova-3 multilingual understands Hindi, English AND Hinglish code-switching,
      // so it actually transcribes what the user says instead of forcing Hindi.
      model: 'nova-3',
      language: 'multi',
      smart_format: 'true',
      interim_results: 'true',
      // Snappier turn-taking: fire ~150ms after you stop instead of 300ms,
      // with an 800ms fallback so a natural mid-sentence pause won't cut you off.
      endpointing: '150',
      utterance_end_ms: '800',
      encoding: 'linear16',
      sample_rate: String(rate),
    }).toString()
  }

  private async connect() {
    if (!this.isListening) return
    try {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {})
      }

      const res = await fetch('/api/deepgram-token', { method: 'POST' })
      if (!res.ok) throw new Error(`token ${res.status}`)
      const { token, temporary } = (await res.json()) as { token?: string; temporary?: boolean }
      if (!token) throw new Error('no token')

      // Auth via WebSocket subprotocol. A short-lived grant token (JWT) must use
      // the "bearer" scheme; a raw API key uses "token". Sending a JWT as "token"
      // (or vice versa) returns 401 Invalid credentials and the socket dies.
      const scheme = temporary ? 'bearer' : 'token'
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${this.dgQuery()}`, [scheme, token])
      this.ws = ws

      ws.onopen = () => {
        // KeepAlive so Deepgram doesn't drop the socket during a pause.
        this.keepAliveTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
          }
        }, 8000)
      }
      ws.onmessage = (evt) => this.handleMessage(evt)
      ws.onerror = () => {
        // onclose fires right after; reconnection handled there.
      }
      ws.onclose = () => {
        if (this.keepAliveTimer) {
          clearInterval(this.keepAliveTimer)
          this.keepAliveTimer = null
        }
        this.ws = null
        if (this.isListening) this.scheduleReconnect()
      }
    } catch (err) {
      console.warn('[Deepgram] connect failed, retrying:', err)
      if (this.isListening) this.scheduleReconnect()
    }
  }

  private handleMessage(evt: MessageEvent) {
    let msg: {
      type?: string
      is_final?: boolean
      speech_final?: boolean
      channel?: { alternatives?: { transcript?: string }[] }
    }
    try {
      msg = JSON.parse(evt.data)
    } catch {
      return
    }

    if (msg.type === 'Results') {
      const text = msg.channel?.alternatives?.[0]?.transcript?.trim() || ''
      if (text && msg.is_final) {
        this.finalBuffer += (this.finalBuffer ? ' ' : '') + text
      }
      // Live feedback so the user can see it hearing them in real time.
      if (text && !this.isPaused && this.onInterim) {
        this.onInterim((this.finalBuffer ? this.finalBuffer + ' ' : '') + (msg.is_final ? '' : text))
      }
      if (msg.speech_final) this.flush()
    } else if (msg.type === 'UtteranceEnd') {
      this.flush()
    }
  }

  private flush() {
    const transcript = this.finalBuffer.trim()
    this.finalBuffer = ''
    if (transcript && !this.isPaused && this.onTranscript) {
      this.pause() // mirror old behavior: stop listening while processing & speaking
      this.onTranscript(transcript)
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.isListening) this.connect()
    }, 600)
  }

  pause() {
    this.isPaused = true
    this.finalBuffer = ''
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
    // Watchdog: never deadlock if resume() is missed (e.g. TTS onEnd never fires).
    this.watchdogTimer = setTimeout(() => {
      if (this.isListening && this.isPaused) this.resume()
    }, 14000)
  }

  resume() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
    this.isPaused = false
    this.finalBuffer = ''
    if (!this.isListening) return
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Socket died while paused — bring it back.
      this.connect()
    }
  }

  stop() {
    this.isListening = false
    this.isPaused = false
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
    if (this.processor) {
      try {
        this.processor.disconnect()
        this.processor.onaudioprocess = null
      } catch {}
    }
    if (this.source) {
      try {
        this.source.disconnect()
      } catch {}
    }
    if (this.mute) {
      try {
        this.mute.disconnect()
      } catch {}
    }
    // Only close the context if we created it. When reusing the mic's shared
    // context, closing it here would also kill the live visualizer.
    if (this.audioCtx && this.ownsCtx) {
      this.audioCtx.close().catch(() => {})
    }
    this.processor = null
    this.source = null
    this.mute = null
    this.audioCtx = null
    if (this.ws) {
      try {
        this.ws.close()
      } catch {}
    }
    this.ws = null
  }
}
