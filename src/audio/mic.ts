// getUserMedia, one AudioContext, taps the stream twice (local analysis + Deepgram).
// Called after the user clicks Enter and grants mic permission.

import { FRAME_SIZE } from '../config.js'

export interface MicHandle {
  context: AudioContext
  stream: MediaStream
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode
}

export async function openMic(): Promise<MicHandle> {
  // Echo cancellation + noise suppression so the mic mostly hears the user and
  // not the tree's own voice through the speakers. This is what makes barge-in
  // (interrupting the tree) reliable instead of the tree hearing itself.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  })
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = FRAME_SIZE * 2
  source.connect(analyser)
  return { context, stream, analyser, source }
}
