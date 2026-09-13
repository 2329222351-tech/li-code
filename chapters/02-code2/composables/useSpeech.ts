// composables/useSpeech.ts
// 封装 Web Speech API 用于英语单词/例句朗读
// 读 useSpeechSettings 的 voice / rate / pitch / volume / lang
// 暴露丰富状态供设置面板展示（voices / speaking / error / supported / lastSpoken）

export interface SpeakOptions {
  text?: string
  lang?: string
  rate?: number
  pitch?: number
  volume?: number
  voiceURI?: string | null
}

export interface SpeechDiag {
  supported: boolean
  voices: SpeechSynthesisVoice[]
  speaking: boolean
  pending: boolean
  paused: boolean
  lastSpoken: { text: string, at: number } | null
  error: string | null
  userAgent: string
}

const _synth = ref<SpeechSynthesis | null>(null)
const _voices = ref<SpeechSynthesisVoice[]>([])
const _speaking = ref(false)
const _pending = ref(false)
const _paused = ref(false)
const _error = ref<string | null>(null)
const _lastSpoken = ref<{ text: string, at: number } | null>(null)
const _supported = ref(false)
let _diagReady = false
let _userAgent = ''

function init() {
  if (_diagReady) return
  _diagReady = true
  if (typeof window === 'undefined') return
  _userAgent = navigator.userAgent
  if (!('speechSynthesis' in window)) {
    _error.value = '浏览器不支持 Web Speech API'
    return
  }
  _supported.value = true
  const s = window.speechSynthesis
  _synth.value = s
  const initial = s.getVoices()
  if (initial && initial.length > 0) _voices.value = initial
  s.onvoiceschanged = () => {
    const v = s.getVoices()
    if (v && v.length > 0) _voices.value = v
  }
  // 一些浏览器在 onvoiceschanged 之外需要轮询
  let polls = 0
  const pollId = setInterval(() => {
    polls++
    const v = s.getVoices()
    if (v && v.length > 0) {
      _voices.value = v
      clearInterval(pollId)
    } else if (polls > 20) {
      clearInterval(pollId)
    }
  }, 250)
}

function pickVoice(voices: SpeechSynthesisVoice[], preferredURI: string | null, lang: string): { voice: SpeechSynthesisVoice | null, tier: 'exact-uri' | 'exact-lang' | 'partial' | 'default' | 'first' | 'none' } {
  if (preferredURI) {
    const exact = voices.find(v => v.voiceURI === preferredURI)
    if (exact) return { voice: exact, tier: 'exact-uri' }
  }
  const sameLang = voices.find(v => v.lang === lang)
  if (sameLang) return { voice: sameLang, tier: 'exact-lang' }
  const langPrefix = lang.split('-')[0]
  const partial = voices.find(v => v.lang?.startsWith(langPrefix))
  if (partial) return { voice: partial, tier: 'partial' }
  const def = voices.find(v => v.default)
  if (def) return { voice: def, tier: 'default' }
  if (voices.length > 0) return { voice: voices[0], tier: 'first' }
  return { voice: null, tier: 'none' }
}

export function useSpeech() {
  if (typeof window !== 'undefined' && !_diagReady) init()

  const { settings } = useSpeechSettings()

  function speak(text: string, opts: SpeakOptions = {}) {
    if (!text) return
    const s = _synth.value
    if (!s) {
      _error.value = 'speechSynthesis 未初始化'
      return
    }
    // 关键：先 cancel，避免叠音
    try { s.cancel() } catch { /* ignore */ }
    _error.value = null
    const utter = new SpeechSynthesisUtterance(text)
    // 参数优先级：调用方 opts > 用户设置 > 默认 en-US / 1 / 1 / 1
    const lang = opts.lang ?? settings.value.lang ?? 'en-US'
    const rate = opts.rate ?? settings.value.rate ?? 1.0
    const pitch = opts.pitch ?? settings.value.pitch ?? 1.0
    const volume = opts.volume ?? settings.value.volume ?? 1.0
    const voiceURI = opts.voiceURI !== undefined ? opts.voiceURI : settings.value.voiceURI
    utter.lang = lang
    utter.rate = rate
    utter.pitch = pitch
    utter.volume = volume
    const picked = pickVoice(_voices.value, voiceURI, lang)
    if (picked.voice) utter.voice = picked.voice
    // 兜底情况给个提示，但仍然 speak（让用户至少听到点什么）
    if (picked.tier === 'default' || picked.tier === 'first' || picked.tier === 'partial') {
      const note = `[tts] 没有完美匹配 lang="${lang}" 的 voice；用 ${picked.tier} 兜底：${picked.voice?.name} (${picked.voice?.lang})`
      console.warn(note)
    }
    if (picked.tier === 'none') {
      _error.value = `没有可用的 voice；当前设置 lang="${lang}"`
      return
    }
    utter.onstart = () => {
      _speaking.value = true
      _pending.value = false
      _lastSpoken.value = { text, at: Date.now() }
    }
    utter.onend = () => {
      _speaking.value = false
      _pending.value = false
    }
    utter.onerror = (ev) => {
      _speaking.value = false
      _pending.value = false
      _error.value = `朗读错误：${ev.error || 'unknown'}（text="${text}"）`
    }
    _pending.value = true
    try {
      s.speak(utter)
    } catch (e: any) {
      _speaking.value = false
      _pending.value = false
      _error.value = `speak() 抛出：${e?.message || e}`
    }
  }

  function stop() {
    if (_synth.value) {
      try { _synth.value.cancel() } catch { /* ignore */ }
    }
    _speaking.value = false
    _pending.value = false
  }

  function pause() {
    if (_synth.value && _speaking.value) {
      try { _synth.value.pause() } catch { /* ignore */ }
      _paused.value = true
    }
  }

  function resume() {
    if (_synth.value && _paused.value) {
      try { _synth.value.resume() } catch { /* ignore */ }
      _paused.value = false
    }
  }

  // 卸载组件时停掉正在播的
  onScopeDispose(() => {
    stop()
  })

  return {
    speak,
    stop,
    pause,
    resume,
    supported: computed(() => _supported.value),
    speaking: computed(() => _speaking.value),
    pending: computed(() => _pending.value),
    paused: computed(() => _paused.value),
    error: computed(() => _error.value),
    lastSpoken: computed(() => _lastSpoken.value),
    voices: computed(() => _voices.value),
    userAgent: computed(() => _userAgent),
    settings
  }
}
