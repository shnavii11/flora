# Benchmark Audio Clips

These are the **real recorded clips** the benchmark runs on (mono, 44.1 kHz, 16-bit WAV):

| File | What it is |
|------|------------|
| `dinner.wav`  | people chatting at dinner |
| `jarvis.wav`  | assistant-style voice |
| `harvard.wav` | Harvard sentences with pauses |
| `female.wav`  | continuous female speech |
| `talking.wav` | continuous talking |

`labels.json` holds the ground-truth speech intervals per clip, e.g.
`"dinner.wav": { "speech": [[0.0, 3.83], [4.28, 5.38]] }`.

## Adding a new clip
1. Drop any audio file in this folder.
2. Convert to the right format:
   `ffmpeg -y -i in.mp3 -ac 1 -ar 44100 -sample_fmt s16 -map_metadata -1 -bitexact clip.wav`
3. Add its name to `CLIPS` in `benchmark/make_labels.py`, then:
   `python3 benchmark/make_labels.py` (drafts labels) →
   `python3 benchmark/plot_labels.py` (draw a picture to verify by ear) →
   fix any labels in `labels.json` → `npx tsx benchmark/run.ts`.
