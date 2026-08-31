import { GROWTH_SPEED } from '../config.js'

export type LifecycleStage = 'dormant' | 'venting' | 'consoling' | 'happy_ending'

export class TreeLifecycle {
  private stage: LifecycleStage = 'dormant'
  private conversationTurns = 0
  private confidenceScore = 0.25
  private superBloomProgress = 0
  private droopTarget = 0
  private currentDroop = 0
  private voiceGrowth = 0 // 0..1, accumulated from the user's live voice

  setStage(next: LifecycleStage) {
    if (this.stage !== next && this.stage !== 'happy_ending') {
      this.stage = next
    }
  }

  getStage(): LifecycleStage {
    return this.stage
  }

  recordTurn() {
    this.conversationTurns++
  }

  updateConfidence(score: number) {
    this.confidenceScore = Math.min(Math.max(score, 0.1), 1.0)
    // Never auto-end from a single upbeat sentence. The session may only wind
    // down on its own after a genuine conversation (several turns) AND the user
    // sounding clearly at peace. Otherwise ending is the user's call (button or
    // an explicit spoken goodbye), and every sentence gets a real reply first.
    if (
      this.confidenceScore >= 0.92 &&
      this.conversationTurns >= 6 &&
      this.stage !== 'happy_ending'
    ) {
      this.triggerHappyEnding()
    }
  }

  getConfidenceScore(): number {
    return this.confidenceScore
  }

  setSadDroop(isSadOrLow: boolean) {
    this.droopTarget = isSadOrLow ? 0.85 : 0.0
  }

  getDroopIntensity(): number {
    if (this.stage === 'happy_ending' || this.voiceGrowth >= 0.9) return 0
    return this.currentDroop
  }

  triggerHappyEnding() {
    this.stage = 'happy_ending'
    this.superBloomProgress = 0
    this.droopTarget = 0
    this.currentDroop = 0
  }

  /**
   * Feed the tree the user's live voice each frame so it matures gradually
   * *while they speak* (louder + higher pitch grows a touch faster), and simply
   * holds — never shrinks — during silence. Ambient room noise is ignored.
   */
  feedVoice(energy: number, pitch: number, dt: number) {
    if (this.stage === 'dormant' || this.stage === 'happy_ending') return
    if (energy <= 0.08) return // below this it's just background noise
    const drive = energy * (0.6 + 0.8 * pitch)
    this.voiceGrowth = Math.min(this.voiceGrowth + drive * GROWTH_SPEED * dt, 1.0)
  }

  getVoiceGrowth(): number {
    return this.voiceGrowth
  }

  tick(dt: number) {
    if (this.stage === 'happy_ending') {
      this.superBloomProgress = Math.min(this.superBloomProgress + dt * 0.5, 1.0)
    }

    // Dynamic droop lerp (resets to 0 when tree completes growth)
    const effectiveTarget = (this.stage === 'happy_ending' || this.voiceGrowth >= 0.9) ? 0 : this.droopTarget
    this.currentDroop += (effectiveTarget - this.currentDroop) * (dt * 2.5)
  }

  getGrowthScale(): number {
    if (this.stage === 'dormant') return 0.65
    if (this.stage === 'happy_ending') return 1.4 + this.superBloomProgress * 0.45
    // Live voice is the primary grower; the counselor's read on the user
    // (confidence) nudges the final size a little on top.
    return 0.7 + this.voiceGrowth * 0.7 + this.confidenceScore * 0.35
  }

  getBloomProgress(): number {
    if (this.stage === 'dormant') return 0.1
    if (this.stage === 'happy_ending') return 1.0
    return 0.2 + this.confidenceScore * 0.55 + this.voiceGrowth * 0.25
  }
}
