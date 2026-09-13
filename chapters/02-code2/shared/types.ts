// Shared types between client and server.
// Files in `shared/` are auto-imported on both sides by Nuxt 3.12+.

export interface PingResponse {
  ok: boolean
  message: string
  time: string
}

export interface Word {
  word: string
  translation: string
  phonetic: string
  pos: string
  difficulty: 1 | 2 | 3 | 4 | 5
  example: string
  example_translation: string
  source?: 'ielts' | 'toefl' | 'both'  // 该词来自哪些词书
}

export interface Question {
  word: Word
  options: string[]
  correctIndex: number
}

export interface AnswerResult {
  correct: boolean
  correctAnswer: string
  userAnswer: string
  word: Word
}

export interface GameState {
  currentLevel: number
  score: number
  combo: number
  maxCombo: number
  totalAnswered: number
  totalCorrect: number
  wrongWords: string[]
}
