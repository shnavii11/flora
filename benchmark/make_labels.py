#!/usr/bin/env python3
# Provisional ground-truth labels for the REAL clips, built with ffmpeg
# silencedetect (an INDEPENDENT energy tool, not our VAD). Speech = the gaps
# between detected silences. Disclosed as provisional: verify by ear before
# quoting these numbers.
import subprocess, re, json, sys, os

CLIPS = ["dinner.wav", "female.wav", "talking.wav", "jarvis.wav", "harvard.wav"]
NOISE_DB = "-30dB"   # anything quieter than this counts as silence
MIN_SIL = "0.25"      # ignore silences shorter than 250 ms

here = os.path.dirname(os.path.abspath(__file__))
audio = os.path.join(here, "audio")

def duration(path):
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=nw=1:nk=1", path], capture_output=True, text=True).stdout
    return float(out.strip())

def silences(path):
    # silencedetect prints silence_start / silence_end to stderr
    p = subprocess.run(["ffmpeg","-i",path,"-af",
        f"silencedetect=noise={NOISE_DB}:d={MIN_SIL}","-f","null","-"],
        capture_output=True, text=True)
    log = p.stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends   = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return starts, ends

def speech_intervals(path):
    dur = duration(path)
    starts, ends = silences(path)
    # Build silence intervals, then take the complement = speech.
    sil = []
    si, ei = 0, 0
    # pair them up in order
    cur = 0.0
    # Represent silence as list of (a,b)
    pairs = []
    s_idx = 0
    e_idx = 0
    # ffmpeg emits start then matching end; a trailing start may have no end
    ss = starts[:]
    ee = ends[:]
    while ss:
        a = ss.pop(0)
        b = ee.pop(0) if ee else dur
        pairs.append((max(0.0,a), min(dur,b)))
    # complement
    speech = []
    prev_end = 0.0
    for (a,b) in pairs:
        if a - prev_end > 0.05:
            speech.append([round(prev_end,2), round(a,2)])
        prev_end = b
    if dur - prev_end > 0.05:
        speech.append([round(prev_end,2), round(dur,2)])
    # if no silence found at all -> whole clip is speech
    if not pairs:
        speech = [[0.0, round(dur,2)]]
    return dur, speech

labels = {"_note": "PROVISIONAL labels from ffmpeg silencedetect (-30dB, 0.25s). "
                    "Independent of our VAD, but auto-generated — verify by ear before quoting."}
for c in CLIPS:
    path = os.path.join(audio, c)
    dur, sp = speech_intervals(path)
    labels[c] = {"speech": sp}
    total_speech = sum(b-a for a,b in sp)
    print(f"{c:12s} dur={dur:5.1f}s  speech={total_speech:5.1f}s ({100*total_speech/dur:4.0f}%)  intervals={sp}")

with open(os.path.join(audio, "labels.json"), "w") as f:
    json.dump(labels, f, indent=2)
print("\nwrote", os.path.join(audio, "labels.json"))
