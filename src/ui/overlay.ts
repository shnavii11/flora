import type { TreeArchetype } from '../render/materials.js'

export function initOverlay(onEnter: (selectedSpecies: TreeArchetype) => void) {
  const overlay = document.getElementById('overlay')!
  const btn = document.getElementById('enter-btn')!
  const speciesBtns = document.querySelectorAll('.species-opt')

  let selectedSpecies: TreeArchetype = 'oak'

  speciesBtns.forEach((b) => {
    b.addEventListener('click', () => {
      speciesBtns.forEach((other) => other.classList.remove('active'))
      b.classList.add('active')
      selectedSpecies = (b.getAttribute('data-species') as TreeArchetype) || 'oak'
    })
  })

  btn.addEventListener('click', () => {
    overlay.classList.add('hidden')
    overlay.addEventListener(
      'transitionend',
      () => {
        overlay.style.display = 'none'
      },
      { once: true }
    )
    onEnter(selectedSpecies)
  })
}
