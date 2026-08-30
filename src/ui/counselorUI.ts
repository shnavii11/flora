export function initCounselorUI(onCompleteSession: () => void) {
  const finishBtn = document.createElement('button')
  finishBtn.id = 'finish-session-btn'
  finishBtn.innerHTML = '<span>Complete Session & Farewell</span>'
  finishBtn.style.position = 'fixed'
  finishBtn.style.bottom = '24px'
  finishBtn.style.right = '240px'
  finishBtn.style.zIndex = '10'
  finishBtn.style.background = 'rgba(13, 20, 36, 0.75)'
  finishBtn.style.backdropFilter = 'blur(16px)'
  finishBtn.style.border = '1px solid rgba(254, 240, 138, 0.35)'
  finishBtn.style.color = 'var(--accent-gold, #fef08a)'
  finishBtn.style.borderRadius = '30px'
  finishBtn.style.padding = '10px 22px'
  finishBtn.style.fontFamily = "'Plus Jakarta Sans', sans-serif"
  finishBtn.style.fontSize = '12px'
  finishBtn.style.fontWeight = '600'
  finishBtn.style.letterSpacing = '0.03em'
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
      finishBtn.style.display = 'block'
    },
    hide() {
      finishBtn.style.display = 'none'
    },
  }
}
