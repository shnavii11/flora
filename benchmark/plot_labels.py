#!/usr/bin/env python3
# Draw each clip's loudness over time with the current labels shaded,
# so a human can verify the speech regions by ear against the picture.
import json, os, wave
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

here = os.path.dirname(os.path.abspath(__file__))
audio = os.path.join(here, "audio")
labels = json.load(open(os.path.join(audio, "labels.json")))
clips = [c for c in labels if not c.startswith("_")]

def read_wav(path):
    w = wave.open(path, "rb")
    sr = w.getframerate()
    n = w.getnframes()
    raw = w.readframes(n)
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return x, sr

def rms_env(x, sr, win_ms=25):
    win = max(1, int(sr * win_ms / 1000))
    n = len(x) // win
    e = np.array([np.sqrt(np.mean(x[i*win:(i+1)*win]**2)) for i in range(n)])
    t = (np.arange(n) * win) / sr
    return t, e

fig, axes = plt.subplots(len(clips), 1, figsize=(11, 2.4*len(clips)))
if len(clips) == 1:
    axes = [axes]

for ax, clip in zip(axes, clips):
    x, sr = read_wav(os.path.join(audio, clip))
    t, e = rms_env(x, sr)
    dur = len(x) / sr
    ax.plot(t, e, color="#2a7", lw=0.9)
    ax.fill_between(t, 0, e, color="#2a7", alpha=0.25)
    # shade current speech labels
    for i, (a, b) in enumerate(labels[clip]["speech"]):
        ax.axvspan(a, b, color="#4488ff", alpha=0.18,
                   label="labeled speech" if i == 0 else None)
        ax.text((a+b)/2, ax.get_ylim()[1] if False else e.max()*0.92,
                f"{a:.2f}-{b:.2f}", ha="center", va="top", fontsize=7, color="#1155cc")
    ax.set_xlim(0, dur)
    ax.set_xticks(np.arange(0, dur+0.001, 0.5))
    ax.grid(axis="x", ls=":", alpha=0.4)
    ax.set_title(f"{clip}   ({dur:.2f}s)   — blue = currently labeled speech", fontsize=10, loc="left")
    ax.set_ylabel("loudness")
    ax.legend(loc="upper right", fontsize=7)

axes[-1].set_xlabel("time (seconds)")
plt.tight_layout()
out = os.path.join(here, "labels_check.png")
plt.savefig(out, dpi=120)
print("wrote", out)
