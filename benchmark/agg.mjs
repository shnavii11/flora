// Reads artifacts/results.json and prints one aggregate line for `ours`:
//   falseActivations, missedOnsets, flicker/sec (avg), onsetLatency median ms, frameAccuracy avg
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const here = dirname(fileURLToPath(import.meta.url))
const r = JSON.parse(readFileSync(join(here, 'artifacts', 'results.json'), 'utf8'))
const med = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0
const side = k => {
  const fa = r.reduce((s, c) => s + c[k].falseActivations, 0)
  const mo = r.reduce((s, c) => s + c[k].missedOnsets, 0)
  const fl = (r.reduce((s, c) => s + c[k].flickerPerSec, 0) / r.length)
  const lat = med(r.flatMap(c => c[k].onsetLatencyMs))
  const acc = (r.reduce((s, c) => s + c[k].frameAccuracy, 0) / r.length)
  return `${fa}\t${mo}\t${fl.toFixed(2)}\t${lat.toFixed(0)}\t${acc.toFixed(1)}`
}
console.log(`ours\t${side('ours')}`)
console.log(`base\t${side('baseline')}`)
