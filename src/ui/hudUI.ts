import type { RiddleManager } from '../riddles.js'
import type { TreeLifecycle } from '../render/lifecycle.js'
import { resetCamera, toggleAutoRotate } from '../render/threeSketch.js'

export function initHUD(riddleManager: RiddleManager, lifecycle: TreeLifecycle) {
  const hudHeader = document.getElementById('hud-header')!
  const spatialToolbar = document.getElementById('spatial-toolbar')!
  const stageText = document.getElementById('stage-text')!
  const pitchFill = document.getElementById('pitch-fill')!
  const pitchText = document.getElementById('pitch-text')!
  const activeSpeciesBadge = document.getElementById('active-species-badge')!

  const btnResetCam = document.getElementById('btn-reset-cam')!
  const btnToggleOrbit = document.getElementById('btn-toggle-orbit')!
  const btnOpenRiddles = document.getElementById('btn-open-riddles')!
  const riddlesBadge = document.getElementById('riddles-badge')!

  const riddlesModal = document.getElementById('riddles-modal')!
  const riddlesCloseBtn = document.getElementById('riddles-close-btn')!
  const riddlesList = document.getElementById('riddles-list')!

  // Camera toolbar events
  btnResetCam.addEventListener('click', () => {
    resetCamera()
  })

  btnToggleOrbit.addEventListener('click', () => {
    const isRotating = toggleAutoRotate()
    if (isRotating) {
      btnToggleOrbit.classList.add('active')
    } else {
      btnToggleOrbit.classList.remove('active')
    }
  })

  // Riddles Modal open/close
  const renderRiddles = () => {
    const unlocked = riddleManager.getUnlockedRiddles()
    riddlesList.innerHTML = ''

    if (unlocked.length === 0) {
      riddlesList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          No riddles have bloomed yet.<br>Speak to help the tree grow and unlock wisdom.
        </div>
      `
      return
    }

    unlocked.forEach((r) => {
      const card = document.createElement('div')
      card.className = 'riddle-card-item'

      card.innerHTML = `
        <div class="riddle-q-en">"${r.questionEn}"</div>
        <div class="riddle-q-hi">${r.questionHi}</div>
        <div class="riddle-hint">Hint: ${r.hintEn}</div>
        <div class="riddle-answer-box hidden" id="ans-${r.id}">
          Answer: ${r.answerEn}
        </div>
        <button class="unveil-btn" data-id="${r.id}">Unveil Wisdom</button>
      `

      const unveilBtn = card.querySelector('.unveil-btn') as HTMLButtonElement
      const ansBox = card.querySelector(`#ans-${r.id}`) as HTMLDivElement

      unveilBtn.onclick = () => {
        ansBox.classList.remove('hidden')
        unveilBtn.style.display = 'none'
      }

      riddlesList.appendChild(card)
    })
  }

  btnOpenRiddles.addEventListener('click', () => {
    renderRiddles()
    riddlesModal.classList.remove('hidden')
  })

  riddlesCloseBtn.addEventListener('click', () => {
    riddlesModal.classList.add('hidden')
  })

  riddlesModal.addEventListener('click', (e) => {
    if (e.target === riddlesModal) {
      riddlesModal.classList.add('hidden')
    }
  })

  // Listen for riddle unlocks to update badge
  riddleManager.onRiddleUnlocked(() => {
    const count = riddleManager.getUnlockedRiddles().length
    if (count > 0) {
      riddlesBadge.innerText = String(count)
      riddlesBadge.classList.remove('hidden')
    }
  })

  return {
    showHUD(speciesName: string) {
      hudHeader.classList.remove('hidden')
      spatialToolbar.classList.remove('hidden')
      activeSpeciesBadge.innerText = speciesName
    },

    updatePitchAndStage(pitchNorm: number, energy: number) {
      const stage = lifecycle.getStage()

      // Stage label update
      if (stage === 'dormant') stageText.innerText = 'Dormant Seedling'
      else if (stage === 'venting') stageText.innerText = 'Venting & Shedding'
      else if (stage === 'consoling') stageText.innerText = 'Consoling Bloom'
      else if (stage === 'happy_ending') stageText.innerText = 'Radiant Bloom'

      // Pitch fill update
      const pct = Math.round(pitchNorm * 100)
      pitchFill.style.width = `${pct}%`

      if (pitchNorm < 0.35) {
        pitchText.innerText = 'Melancholy / Droop'
        pitchFill.style.background = 'linear-gradient(90deg, #94a3b8, #38bdf8)'
      } else if (pitchNorm > 0.65) {
        pitchText.innerText = 'Reach & Bloom'
        pitchFill.style.background = 'linear-gradient(90deg, #fef08a, #34d399)'
      } else {
        pitchText.innerText = 'Steady'
        pitchFill.style.background = 'linear-gradient(90deg, #38bdf8, #fef08a)'
      }
    },
  }
}
