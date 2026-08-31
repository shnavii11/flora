# flora

a voice counselor that grows a 3d tree while it listens to you.

**current status:** working end to end in safari (and chrome). you speak, the browser transcribes on device, a gemini counselor replies in hindi, and a sarvam voice speaks it back sentence by sentence. the tree grows branch by branch as you talk, and the camera eases back to keep the whole tree in frame.

## what it does

you speak, a tree listens. as you keep talking it grows, branch by branch, from a bare trunk into a full canopy of leaves and blossoms, and a gentle hindi voice replies, reflecting what you said and asking a soft follow up. it is not a productivity tool and it is not trying to fix you. it is about being heard, the slow floral kind of comfort that people who talk to their plants already know. the tree is the listener that never rushes you.

## features

- voice in, voice out. you speak, it transcribes, it thinks, it speaks back in hindi.
- a 3d tree that grows as branches, not as size. the more you speak, the more of it is revealed, trunk first, then limbs, twigs, leaves, and finally flowers.
- instant turn taking. a voice detector notices the moment you stop and replies right away instead of waiting.
- a warm hindi counselor voice that mirrors your words instead of giving generic lines, spoken sentence by sentence so it starts almost immediately.
- barge in. if you start talking while the tree is speaking, it stops and listens.
- live captions. you see what it heard you say and read its reply on screen.
- four tree species, each with its own shape and mood.
- a camera that keeps the whole tree framed as it grows, a soft night ground, drifting motes, glowing wisdom riddle orbs floating above the canopy, and a full 360 degree orbit.

## how listening works

speech to text runs in the browser itself, using the built in recognizer (webkitSpeechRecognition in safari). it needs no key and no server round trip. it listens for hindi first and falls back to english if hindi dictation is not available. the browser recognizer can be slow to declare a sentence final, so we do not wait for it, an energy based voice detector decides when you have stopped and commits the transcript immediately.

earlier this used a deepgram streaming transcriber. it would not authenticate from the deployed page in safari, the audio reached the app but the socket never returned text, so we moved to the built in recognizer. the deepgram files are still in the repo but unused.

## what we tuned and why

no custom model was trained. what is tuned is the pipeline and the numbers that make it feel alive.

audio framing
- frame size 512 samples, about 10.7 ms at 48 khz, a power of two so the 1024 point fft stays fast and tracks pitch from 70 to 500 hz.
- one second of silence at the start measures the room noise floor.

turn taking
- the visualizer voice detector uses hysteresis, 9 db above the floor to start and 4 db to stop, with a 600 ms hold so pauses between words do not chop your speech. this drives the tree reaction and barge in.
- turn ending uses a separate adaptive detector that tracks the live background, treats your voice as a jump of about 2.6x above it, and commits the moment you drop below 1.6x for 500 ms. auto gain control is turned off on this mic so it does not amplify room noise when you go quiet.
- barge in after about 6 frames, roughly 100 ms of speech over the tree, so a cough does not cut it off.

reply and voice
- reply limit 160 tokens, temperature 0.35, one to two short hindi sentences, with the last 4 turns kept as memory.
- the voice is sarvam bulbul v3 at pace 1.05, synthesized sentence by sentence and played in order so the first sentence starts while the rest are still generating. if it fails it falls back to the browser voice.

growth
- growth speed 0.42 per second with an energy gate of 0.08, so a few seconds of real speech grows the tree while quiet room noise does not.
- the tree is a fixed skeleton revealed progressively, it does not scale, and the camera eases from a close 12 units out to about 23 as more of it appears.

## honest status

- can it hear you. yes, in the browser, hindi first with english fallback. it is not full hinglish code switching, that was the old streaming transcriber.
- is the latency decent. yes. the detector commits the instant you stop, replies are short, and the voice streams sentence by sentence, so the gap is small.
- does the interrupt work. mostly. talking over the tree stops it, and echo cancellation keeps it from hearing itself, but a loud room or leftover echo can still trip it now and then.

## benchmark

`benchmark/` measures the frame level visualizer voice detector (`src/audio/vad.ts`) against a naive fixed threshold baseline on five real recorded clips (42.6 s, hand verified labels), and writes `benchmark/artifacts/report.md`. full write up in `benchmark/RESULTS.md`.

honest headline: ours is about 40x smoother (flicker 0.1 vs 4.6 toggles/sec) on every clip and never misses a speech onset. when a clip starts with a quiet moment it also beats the baseline on accuracy (dinner 76 vs 71, jarvis 97 vs 90), because it calibrates to the room floor. it loses on two clips that are loud from the first frame (female, talking, both 0 percent) because it needs a quiet second to calibrate the floor, which the live app guarantees with its calibration phase but a raw clip does not. on harvard it is perfectly smooth with zero missed onsets but scores a little below baseline because the 600 ms hold fills the short gaps between sentences. note this benchmarks the detector that drives the tree reaction and barge in, not the newer turn ending detector in `main.ts`, which is not yet covered.

## running it

you need two keys, google for the counselor replies and sarvam for the hindi voice. speech to text runs in the browser and needs no key. a deepgram key in the env is legacy and no longer used.

```
cp .env.example .env
npm install
npm run api    # local api from scripts/dev-server.js
npm run dev    # vite frontend
```

runs in safari (primary) and chrome, both have the built in speech recognizer. deploys to vercel, where the api routes run as serverless functions.

## file structure

```
index.html              the page shell and intro overlay
vite.config.ts          dev server and the proxy to the local api
vercel.json             deploy config for the hosted api functions
package.json            scripts, dev runs vite, api runs the local server

api/
  counselor.ts          hosted function, the counselor reply from gemini
  sarvam-tts.ts         hosted function, hindi text to speech
  deepgram-token.ts     hosted function, legacy speech token, no longer used

scripts/
  dev-server.js         local dev backend, serves the api routes from .env

src/
  main.ts               wires everything, the voice loop, turn endpointer, barge in, captions
  config.ts             visualizer vad and growth numbers (endpointer numbers live in main.ts)
  styles.css            styling

  audio/
    mic.ts              opens the mic, echo cancellation on, auto gain off
    calibrate.ts        measures the room noise floor
    vad.ts              visualizer voice detection with hysteresis
    features.ts         loudness and spectral features
    pitch.ts            pitch tracking
    smoothing.ts        smoothing helpers
    counselorSpeech.ts  plays the voice, sarvam sentence by sentence, browser fallback
    stt.ts              legacy browser only transcriber, unused

  stt/
    webspeech.ts        the active transcriber, browser speech recognition
    deepgram.ts         legacy streaming transcriber, unused
    commands.ts         keyword to visual event mapping

  mapping/
    controls.ts         turns audio features into plant controls

  render/
    threeSketch.ts      scene, camera and auto framing, the render loop
    tree3d.ts           the tree and the branch by branch growth
    lifecycle.ts        stage, confidence, and the voice growth accumulator
    materials.ts        per species materials and configs
    backdrop3d.ts       ground and sky
    grass3d.ts          grass
    particles3d.ts      motes and falling petals
    riddles3d.ts        the floating riddle orbs
    plant.ts, lsystem.ts, sketch.ts, palette.ts, particles.ts   earlier 2d prototype pieces

  ui/
    overlay.ts          the species picker intro
    hudUI.ts            the heads up display
    counselorUI.ts      the finish session button
    debug.ts            the debug panel

  riddles.ts            riddle content and unlock logic
```

## Gallery & demo

### The main interface

<video src="https://github.com/shnavii11/flora/raw/master/assets/main_interface.mp4" controls muted width="100%"></video>

### Watch it grow

<video src="https://github.com/shnavii11/flora/raw/master/assets/plant_growing.mp4" controls muted width="100%"></video>

### Screens

![Intro — speak, and the sanctuary responds](assets/intro.png)

![Ancient Oak — venting, gold motes rising](assets/oak.png)

![Weeping Willow — cascading glow](assets/willow.png)

![Cherry Sakura — in full bloom](assets/sakura.png)
