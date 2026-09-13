// composables/useSpeechSettings.ts
// 管理 TTS 设置 + localStorage 持久化
// 跨页面共享（review 页面和设置面板都读同一份）

export interface SpeechSettings {
  voiceURI: string | null     // null = 让 useSpeech 自动按 lang 挑
  lang: string                // 默认 'en-US'
  rate: number                // 0.1 ~ 10
  pitch: number               // 0 ~ 2
  volume: number              // 0 ~ 1
}

const STORAGE_KEY = 'tts-settings-v1'

const DEFAULTS: SpeechSettings = {
  voiceURI: null,
  lang: 'en-US',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0
}

function load(): SpeechSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    // 容错：缺失字段用默认值补
    return {
      voiceURI: parsed.voiceURI ?? DEFAULTS.voiceURI,
      lang: typeof parsed.lang === 'string' && parsed.lang ? parsed.lang : DEFAULTS.lang,
      rate: clamp(typeof parsed.rate === 'number' ? parsed.rate : DEFAULTS.rate, 0.1, 10),
      pitch: clamp(typeof parsed.pitch === 'number' ? parsed.pitch : DEFAULTS.pitch, 0, 2),
      volume: clamp(typeof parsed.volume === 'number' ? parsed.volume : DEFAULTS.volume, 0, 1)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function save(s: SpeechSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* quota / privacy mode — ignore */ }
}

// 单例状态：所有 useSpeechSettings() 共享同一份 ref
const shared = ref<SpeechSettings>({ ...DEFAULTS })
let inited = false

export function useSpeechSettings() {
  if (typeof window !== 'undefined' && !inited) {
    shared.value = load()
    inited = true
  }

  function update(patch: Partial<SpeechSettings>) {
    shared.value = { ...shared.value, ...patch }
    save(shared.value)
  }

  function reset() {
    shared.value = { ...DEFAULTS }
    save(shared.value)
  }

  return {
    settings: shared,
    update,
    reset,
    DEFAULTS
  }
}
