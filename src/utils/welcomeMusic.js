// Elegant purely-instrumental welcome piano, synthesized with WebAudio.
// No audio files, no licenses, works offline (PWA-friendly).
// Progression C - G - Am - F with soft broken arpeggios and gentle bass.

let ctx = null
let masterGain = null
let timer = null
let nextTime = null
let step = 0
let running = false

const STEP_DUR = 0.42
const EIGHTHS_PER_BAR = 8
const LOOP_STEPS = 32

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

const CHORDS = [
  { bass: 48, notes: [60, 64, 67, 72] }, // C
  { bass: 43, notes: [55, 59, 62, 67] }, // G
  { bass: 45, notes: [57, 60, 64, 69] }, // Am
  { bass: 41, notes: [53, 57, 60, 65] }, // F
]

const ARP = [0, 1, 2, 3, 2, 3, 2, 1]

const ensureContext = () => {
  if (ctx) return ctx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  ctx = new Ctx()
  masterGain = ctx.createGain()
  masterGain.gain.value = 0.0001
  masterGain.connect(ctx.destination)
  return ctx
}

const playTone = (freq, when, dur, vel) => {
  if (!ctx || !masterGain) return
  const partials = [
    { mul: 1, amp: 1 },
    { mul: 2, amp: 0.32 },
    { mul: 3, amp: 0.1 },
  ]
  partials.forEach(({ mul, amp }) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mul
    osc.detune.value = (Math.random() * 6 - 3) * 0.1
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(Math.max(vel * amp, 0.0002), when + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g)
    g.connect(masterGain)
    osc.start(when)
    osc.stop(when + dur + 0.05)
  })
}

const playNote = (midi, when, dur, vel) => {
  playTone(midiToFreq(midi), when, dur, vel)
}

const scheduleStep = (when, stepIndex) => {
  const bar = Math.floor(stepIndex / EIGHTHS_PER_BAR) % CHORDS.length
  const chord = CHORDS[bar]
  const idx = stepIndex % EIGHTHS_PER_BAR
  const noteIdx = ARP[idx]

  if (idx === 0) {
    playNote(chord.bass, when, 2.4, 0.16)
  } else if (idx === 4) {
    playNote(chord.bass, when, 1.8, 0.11)
  }

  playNote(chord.notes[noteIdx], when + 0.004, 1.5, 0.085)
  if (idx === 3) {
    playNote(chord.notes[noteIdx] + 12, when + 0.004, 1.8, 0.045)
  }
}

export const playWelcomeMusic = () => {
  if (running) return
  const c = ensureContext()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const now = c.currentTime
  masterGain.gain.cancelScheduledValues(now)
  masterGain.gain.setValueAtTime(masterGain.gain.value, now)
  masterGain.gain.exponentialRampToValueAtTime(0.9, now + 1.2)
  running = true
  step = 0
  nextTime = now + 0.15
  timer = setInterval(() => {
    if (!running) return
    while (step < LOOP_STEPS && nextTime < c.currentTime + 0.6) {
      scheduleStep(nextTime, step)
      nextTime += STEP_DUR
      step++
    }
    if (step >= LOOP_STEPS) step = 0
  }, 80)
}

export const stopWelcomeMusic = () => {
  running = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (ctx && masterGain) {
    const now = ctx.currentTime
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  }
}

export const resumeWelcomeMusic = () => {
  const c = ensureContext()
  if (c && c.state === 'suspended') void c.resume()
}
