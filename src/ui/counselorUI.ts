export function initCounselorUI(onCompleteSession: () => void) {
  const finishBtn = document.createElement('button')
  finishBtn.id = 'finish-session-btn'
  finishBtn.innerHTML = '✓'
  finishBtn.title = 'End session'
  finishBtn.setAttribute('aria-label', 'End session')
  finishBtn.style.position = 'fixed'
  finishBtn.style.bottom = '24px'
  finishBtn.style.right = '24px'
  finishBtn.style.zIndex = '10'
  finishBtn.style.width = '38px'
  finishBtn.style.height = '38px'
  finishBtn.style.alignItems = 'center'
  finishBtn.style.justifyContent = 'center'
  finishBtn.style.background = 'rgba(13, 20, 36, 0.75)'
  finishBtn.style.backdropFilter = 'blur(16px)'
  finishBtn.style.border = '1px solid rgba(254, 240, 138, 0.35)'
  finishBtn.style.color = 'var(--accent-gold, #fef08a)'
  finishBtn.style.borderRadius = '9px'
  finishBtn.style.padding = '0'
  finishBtn.style.fontFamily = "'Plus Jakarta Sans', sans-serif"
  finishBtn.style.fontSize = '18px'
  finishBtn.style.lineHeight = '1'
  finishBtn.style.cursor = 'pointer'
  finishBtn.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
  finishBtn.style.transition = 'all 0.25s ease'
  finishBtn.style.display = 'none'

  finishBtn.onmouseenter = () => {
    finishBtn.style.background = 'rgba(254, 240, 138, 0.2)'
    finishBtn.style.borderColor = '#fef08a'
    finishBtn.style.transform = 'translateY(-2px) scale(1.03)'
  }
  finishBtn.onmouseleave = () => {
    finishBtn.style.background = 'rgba(13, 20, 36, 0.75)'
    finishBtn.style.borderColor = 'rgba(254, 240, 138, 0.35)'
    finishBtn.style.transform = 'translateY(0) scale(1.0)'
  }
  finishBtn.onclick = () => {
    onCompleteSession()
    finishBtn.style.display = 'none'
  }

  document.body.appendChild(finishBtn)

  return {
    show() {
      finishBtn.style.display = 'flex'
    },
    hide() {
      finishBtn.style.display = 'none'
    },
  }
}
