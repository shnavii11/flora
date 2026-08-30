export interface Riddle {
  id: string
  questionEn: string
  questionHi: string
  answerEn: string
  answerHi: string
  growthThreshold: number // 0.0 to 1.0 growth scale
  hintEn: string
  hintHi: string
}

export const RIDDLES: Riddle[] = [
  {
    id: 'riddle-1',
    questionEn: 'What grows stronger the more you share it, but weighs nothing at all?',
    questionHi: 'वह क्या है जिसे जितना बांटो उतना बढ़ता है, पर जिसका कोई वजन नहीं होता?',
    answerEn: 'Joy & Compassion (आनंद और करुणा)',
    answerHi: 'आनंद और करुणा',
    growthThreshold: 0.35,
    hintEn: 'It warms hearts and lights up quiet rooms.',
    hintHi: 'यह दिलों को गर्माहट देता है।',
  },
  {
    id: 'riddle-2',
    questionEn: 'I fall without getting hurt, and bring peace and green life to the soil. What am I?',
    questionHi: 'मैं बिना चोट खाए गिरती हूँ, और धरती पर हरियाली व शांति लाती हूँ। मैं क्या हूँ?',
    answerEn: 'Raindrops & Gentle Petals (बूँदें और पंखुड़ियाँ)',
    answerHi: 'बूँदें और पंखुड़ियाँ',
    growthThreshold: 0.5,
    hintEn: 'Skyward whispers that soften the earth.',
    hintHi: 'आसमान की बूँदें जो ज़मीन को सहलाती हैं।',
  },
  {
    id: 'riddle-3',
    questionEn: 'I have no voice, yet I heal heavy hearts through quiet listening. What am I?',
    questionHi: 'मेरी कोई आवाज़ नहीं, फिर भी चुपचाप सुनकर भारी दिलों को सहलाती हूँ। मैं क्या हूँ?',
    answerEn: 'Nature & The Counseling Tree (प्रकृति और काउंसलर वृक्ष)',
    answerHi: 'प्रकृति और काउंसलर वृक्ष',
    growthThreshold: 0.7,
    hintEn: 'You are standing before it right now.',
    hintHi: 'आप इस वक्त उसी के सामने खड़े हैं।',
  },
  {
    id: 'riddle-4',
    questionEn: 'I can bend with the wildest storm without breaking, and reach for the sunlight tomorrow. What am I?',
    questionHi: 'मैं तूफान में झुक सकती हूँ पर टूटती नहीं, और कल के सूरज की ओर फिर बढ़ती हूँ। मैं क्या हूँ?',
    answerEn: 'Resilience & Hope (धैर्य और उम्मीद)',
    answerHi: 'धैर्य और उम्मीद',
    growthThreshold: 0.88,
    hintEn: 'The secret strength inside every branch and soul.',
    hintHi: 'हर आत्मा और टहनी की छिपी हुई ताकत।',
  },
]

export class RiddleManager {
  private unlockedRiddleIds: Set<string> = new Set()
  private onRiddleUnlockedCallbacks: ((riddle: Riddle) => void)[] = []

  onRiddleUnlocked(cb: (riddle: Riddle) => void) {
    this.onRiddleUnlockedCallbacks.push(cb)
  }

  checkGrowth(currentScaleNorm: number) {
    for (const r of RIDDLES) {
      if (!this.unlockedRiddleIds.has(r.id) && currentScaleNorm >= r.growthThreshold) {
        this.unlockedRiddleIds.add(r.id)
        this.onRiddleUnlockedCallbacks.forEach((cb) => cb(r))
      }
    }
  }

  getUnlockedRiddles(): Riddle[] {
    return RIDDLES.filter((r) => this.unlockedRiddleIds.has(r.id))
  }

  isUnlocked(id: string): boolean {
    return this.unlockedRiddleIds.has(id)
  }
}
