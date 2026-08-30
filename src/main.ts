import './styles.css'
import {
  startThreeSketch,
  updateControls,
  setTreeArchetype,
  setLifecycleInstance,
  getRiddleManager,
} from './render/threeSketch.js'
import { initOverlay } from './ui/overlay.js'
import { initDebugPanel } from './ui/debug.js'
import { openMic } from './audio/mic.js'
import { createFeatureReader } from './audio/features.js'
import { createPitchDetector } from './audio/pitch.js'
import { measureNoiseFloor } from './audio/calibrate.js'
import { VAD } from './audio/vad.js'
import { featuresToControls } from './mapping/controls.js'
import { DEFAULT_CONTROLS, PlantControls } from './render/plant.js'
import { CounselorSpeechService } from './audio/counselorSpeech.js'
import { TreeLifecycle } from './render/lifecycle.js'
import { initCounselorUI } from './ui/counselorUI.js'
import { initHUD } from './ui/hudUI.js'
import { DeepgramSTTService } from './stt/deepgram.js'
import type { TreeArchetype } from './render/materials.js'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

const container = document.getElementById('canvas-container')!
const calibrationMsg = document.getElementById('calibration-msg')!
const legend = document.getElementById('legend')!
const debug = initDebugPanel()

// Live caption: shows what STT heard + the tree's reply, so mis-transcriptions
// are visible instead of silently producing off-topic answers.
const caption = document.createElement('div')
caption.id = 'caption'
caption.style.cssText = [
  'position:fixed', 'left:50%', 'bottom:88px', 'transform:translateX(-50%)',
  'max-width:min(760px,92vw)', 'z-index:120', 'text-align:center',
  'font-family:\'Plus Jakarta Sans\',sans-serif', 'pointer-events:none',
  'background:rgba(8,14,26,0.85)', 'backdrop-filter:blur(12px)',
  '-webkit-backdrop-filter:blur(12px)',
  'border:1px solid rgba(254,240,138,0.28)', 'border-radius:18px',
  'padding:14px 24px', 'box-shadow:0 12px 44px rgba(0,0,0,.55)',
  'display:none',
].join(';')
document.body.appendChild(caption)
function renderCaption(youSaid: string, treeSaid: string, listening = false) {
  caption.innerHTML =
    (youSaid
      ? `<div style="font-size:13px;color:#93c5fd;margin-bottom:6px">${listening ? '🎧 ' : ''}You said: “${youSaid}”${listening ? '…' : ''}</div>`
      : '') +
    (treeSaid
      ? `<div style="font-size:16px;line-height:1.5;color:#fef08a;text-shadow:0 2px 12px rgba(0,0,0,.6)">🌳 ${treeSaid}</div>`
      : '')
  caption.style.display = 'block'
}
function showCaption(youSaid: string, treeSaid: string) {
  renderCaption(youSaid, treeSaid, false)
}

startThreeSketch(container)

let controls: PlantControls = { ...DEFAULT_CONTROLS }

const counselorSpeech = new CounselorSpeechService()
const lifecycle = new TreeLifecycle()
setLifecycleInstance(lifecycle)
const riddleManager = getRiddleManager()
const hud = initHUD(riddleManager, lifecycle)
const stt = new DeepgramSTTService()

let selectedSpecies: TreeArchetype = 'oak'
const conversationHistory: ChatMessage[] = []

const SPECIES_DISPLAY_NAMES: Record<TreeArchetype, string> = {
  oak: 'Ancient Oak',
  willow: 'Weeping Willow',
  sakura: 'Cherry Sakura',
  redwood: 'Solar Redwood',
}

const FALLBACK_RESPONSES = [
  'आपकी भावनाएं यहां सुरक्षित हैं। मैं आपके साथ हूं, कृपया निसंकोच कहें।',
  'मैं आपकी बात पूरे दिल से सुन रही हूं। आज आपको क्या बात चिंतित कर रही है?',
  'याद रखें कि आपको सब कुछ अकेले नहीं संभालना है। आज हम मिलकर क्या हल्का कर सकते हैं?',
  'शांत महसूस करें। हर विचार और सांस के साथ आप मजबूत हो रहे हैं।',
]

let fallbackIdx = 0

const handleUserVoiceInput = (userText: string) => {
  if (lifecycle.getStage() === 'happy_ending') return

  // Voice-triggered farewell detection in Hindi and English
  if (/thank\s*you|goodbye|bye|i feel better|job finished|धन्यवाद|शुक्रिया|अलविदा|अच्छा लगा|सब ठीक है/i.test(userText)) {
    stt.stop()
    ui.hide()
    lifecycle.triggerHappyEnding()
    const farewell = 'आज आपने बहुत अच्छा काम किया। इस शांति को अपने साथ रखें। धन्यवाद और अपना ख्याल रखें।'
    counselorSpeech.speakAdvice(farewell)
    return
  }

  lifecycle.recordTurn()
  lifecycle.setStage('venting')
  showCaption(userText, '')
  conversationHistory.push({ role: 'user', text: userText })

  fetch('/api/counselor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: userText, history: conversationHistory }),
  })
    .then((r) => r.json())
    .then((data: { adviceText?: string; confidenceScore?: number; emotionalState?: string }) => {
      const responseText = data.adviceText || FALLBACK_RESPONSES[fallbackIdx++ % FALLBACK_RESPONSES.length]
      conversationHistory.push({ role: 'model', text: responseText })
      showCaption(userText, responseText)

      if (typeof data.confidenceScore === 'number') {
        lifecycle.updateConfidence(data.confidenceScore)
      } else {
        lifecycle.updateConfidence(0.5)
      }

      if (lifecycle.getStage() === 'happy_ending') {
        ui.hide()
        const farewell = 'आज आपने बहुत अच्छा काम किया। इस शांति को अपने साथ रखें। धन्यवाद और अपना ख्याल रखें।'
        counselorSpeech.speakAdvice(farewell)
        return
      }

      lifecycle.setStage('consoling')
      counselorSpeech.speakAdvice(
        responseText,
        () => {
          stt.pause()
        },
        () => {
          lifecycle.setStage('venting')
          stt.resume()
        }
      )
    })
    .catch(() => {
      // Fallback response if API call fails -> ALWAYS reply and resume STT
      const responseText = FALLBACK_RESPONSES[fallbackIdx++ % FALLBACK_RESPONSES.length]
      conversationHistory.push({ role: 'model', text: responseText })
      showCaption(userText, responseText)
      lifecycle.setStage('consoling')
      counselorSpeech.speakAdvice(
        responseText,
        () => {
          stt.pause()
        },
        () => {
          lifecycle.setStage('venting')
          stt.resume()
        }
      )
    })
}

const ui = initCounselorUI(() => {
  stt.stop()
  ui.hide()
  lifecycle.triggerHappyEnding()
  counselorSpeech.speakAdvice(
    'आज आपने बहुत अच्छा काम किया। इस शांति को अपने साथ रखें। धन्यवाद और अपना ख्याल रखें।'
  )
})

initOverlay(async (chosenSpecies: TreeArchetype) => {
  try {
    counselorSpeech.initAudioContext()

    selectedSpecies = chosenSpecies
    setTreeArchetype(selectedSpecies)

    hud.showHUD(SPECIES_DISPLAY_NAMES[selectedSpecies])
    ui.show()
    legend.classList.add('visible')

    const mic = await openMic()
    await mic.context.resume()

    const reader = createFeatureReader(mic.analyser, mic.context.sampleRate)
    const pitchDetector = createPitchDetector(mic.context.sampleRate, mic.analyser.fftSize)

    calibrationMsg.classList.add('visible')
    const noiseFloor = await measureNoiseFloor(() => reader.read().rms, mic.context.sampleRate)
    calibrationMsg.classList.remove('visible')

    const vad = new VAD(noiseFloor, mic.context.sampleRate)

    // Tree Speaks First greeting
    const initialPrompt = 'Session start: Greet the user warmly in Hindi (Devanagari script) as their AI Counselor Tree, ask how life has been going for them lately, and invite them to share what is on their mind or heart today.'
    fetch('/api/counselor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: initialPrompt }),
    })
      .then((r) => r.json())
      .then((data: { adviceText?: string }) => {
        const greeting = data.adviceText || 'नमस्ते, मैं आपकी काउंसलर ट्री हूँ। आज आपका दिन कैसा रहा? आपके मन में क्या चल रहा है?'
        conversationHistory.push({ role: 'model', text: greeting })
        showCaption('', greeting)
        counselorSpeech.speakAdvice(
          greeting,
          () => {
            stt.pause()
          },
          () => {
            stt.resume()
          }
        )
      })
      .catch(() => {
        const greeting = 'नमस्ते, मैं आपकी काउंसलर ट्री हूँ। आज आपका दिन कैसा रहा? आपके मन में क्या चल रहा है?'
        conversationHistory.push({ role: 'model', text: greeting })
        showCaption('', greeting)
        counselorSpeech.speakAdvice(
          greeting,
          () => {
            stt.pause()
          },
          () => {
            stt.resume()
          }
        )
      })

    stt.start(
      mic.stream,
      (transcript: string) => {
        handleUserVoiceInput(transcript)
      },
      (interim: string) => {
        // Live "I'm hearing you" feedback while the user is still speaking.
        if (interim && lifecycle.getStage() !== 'consoling') {
          renderCaption(interim, '', true)
        }
      }
    )

    // Barge-in state: how many consecutive frames the user has been speaking
    // over the tree. A short run (not a single blip) is required to avoid the
    // tree cutting itself off on a cough or residual echo.
    let bargeFrames = 0
    const BARGE_IN_FRAMES = 6 // ~100ms of sustained user speech

    const loop = () => {
      const features = reader.read()
      const pitch = pitchDetector.detect(reader.timeBuf)

      const speaking = vad.process(features.rms)

      // If the user starts talking while the tree is speaking, stop the tree and
      // listen — the VAD runs on its own mic tap, so it works even though the
      // Deepgram stream is paused during playback.
      if (counselorSpeech.getSpeakingState() && speaking && lifecycle.getStage() !== 'happy_ending') {
        bargeFrames++
        if (bargeFrames >= BARGE_IN_FRAMES) {
          counselorSpeech.stopSpeech() // onended -> resumes STT
          stt.resume()
          lifecycle.setStage('venting')
          bargeFrames = 0
        }
      } else if (bargeFrames > 0) {
        bargeFrames--
      }

      controls = featuresToControls(features, pitch, speaking, controls)

      updateControls(controls)

      // Trigger sad drooping when pitch is low (<0.35) or stage is venting
      const isSad = controls.pitch < 0.35 || lifecycle.getStage() === 'venting'
      lifecycle.setSadDroop(isSad)

      // Update HUD pitch fill & text
      hud.updatePitchAndStage(controls.pitch, controls.energy)

      debug.update({
        rms: features.rms,
        noiseFloor,
        energy: controls.energy,
        pitchHz: pitch.hz,
        pitchNorm: controls.pitch,
        clarity: pitch.clarity,
        hue: controls.hue,
        flux: controls.flux,
        vad: speaking ? 1 : 0,
      })

      requestAnimationFrame(loop)
    }
    loop()
  } catch (err) {
    console.error('Microphone error:', err)
    calibrationMsg.classList.remove('visible')
    alert('Could not access the microphone. Please allow mic permission and reload.')
  }
})
