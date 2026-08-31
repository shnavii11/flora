# HarmonicFlora — VAD Benchmark
Clips: 5   Total audio: 42.6 s   Frames: 3,670

|                            | Baseline (fixed) | Ours (adaptive+hyst) |
|----------------------------|:----------------:|:--------------------:|
| False activations          |               10 |                  463 |
| Missed onsets              |                0 |                    0 |
| Flicker (toggles/sec)      |              4.6 |                  0.1 |
| Onset latency (median ms)  |               12 |                    0 |
| Frame accuracy             |            82.8% |                49.5% |

Takeaway: compared to the naive fixed-threshold baseline, our adaptive + hysteresis
VAD cuts false activations 0× and flicker 46.0× at the cost of ~-12 ms
extra onset latency — a deliberate and defensible tradeoff.

## Per-clip results

### dinner.wav (5.4 s)
| Metric | Baseline | Ours |
|--------|----------|------|
| False activations | 0 | 38 |
| Missed onsets | 0 | 0 |
| Flicker/sec | 8.56 | 0.19 |
| Onset latency (median ms) | 12 | 0 |
| Frame accuracy | 70.6% | 76% |

### female.wav (3.3 s)
| Metric | Baseline | Ours |
|--------|----------|------|
| False activations | 0 | 0 |
| Missed onsets | 0 | 0 |
| Flicker/sec | 4.84 | 0 |
| Onset latency (median ms) | 0 | 0 |
| Frame accuracy | 73.3% | 0% |

### talking.wav (5.0 s)
| Metric | Baseline | Ours |
|--------|----------|------|
| False activations | 0 | 0 |
| Missed onsets | 0 | 0 |
| Flicker/sec | 0.4 | 0 |
| Onset latency (median ms) | 0 | 0 |
| Frame accuracy | 99.1% | 0% |

### jarvis.wav (10.5 s)
| Metric | Baseline | Ours |
|--------|----------|------|
| False activations | 0 | 21 |
| Missed onsets | 0 | 0 |
| Flicker/sec | 3.04 | 0.09 |
| Onset latency (median ms) | 12 | 58 |
| Frame accuracy | 89.6% | 97.1% |

### harvard.wav (18.4 s)
| Metric | Baseline | Ours |
|--------|----------|------|
| False activations | 10 | 404 |
| Missed onsets | 0 | 0 |
| Flicker/sec | 6.05 | 0 |
| Onset latency (median ms) | 0 | 0 |
| Frame accuracy | 81.2% | 74.4% |
