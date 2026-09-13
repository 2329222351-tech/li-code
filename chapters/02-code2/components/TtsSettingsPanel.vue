<script setup lang="ts">
// components/TtsSettingsPanel.vue
// 详细 TTS 设置面板
// Props: v-model:open 控制显示
// 自带测试朗读、voice 选择、参数调节、诊断信息

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const {
  speak, stop, pause, resume,
  supported, speaking, pending, paused, error, lastSpoken, voices, userAgent
} = useSpeech()
const { settings, update, reset } = useSpeechSettings()

const testText = ref('Hello, this is a test of the text-to-speech system.')
const voiceFilter = ref('')

// 按语言分组 voices
const groupedVoices = computed(() => {
  const filter = voiceFilter.value.trim().toLowerCase()
  const filtered = filter
    ? voices.value.filter(v =>
        (v.lang || '').toLowerCase().includes(filter) ||
        (v.name || '').toLowerCase().includes(filter)
      )
    : voices.value
  const groups = new Map<string, SpeechSynthesisVoice[]>()
  for (const v of filtered) {
    const lang = v.lang || 'unknown'
    if (!groups.has(lang)) groups.set(lang, [])
    groups.get(lang)!.push(v)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lang, items]) => ({
      lang,
      items: items.sort((a, b) => a.name.localeCompare(b.name))
    }))
})

// 匹配当前 lang 的 voices（按"完全匹配" + "lang 前缀匹配" + "default" 三档）
const matchedVoices = computed(() => {
  const lang = settings.value.lang
  const list = voices.value
  const exact = list.filter(v => v.lang === lang)
  if (exact.length > 0) return { tier: 'exact' as const, list: exact }
  const prefix = lang.split('-')[0]
  const partial = list.filter(v => v.lang?.startsWith(prefix))
  if (partial.length > 0) return { tier: 'partial' as const, list: partial }
  const def = list.filter(v => v.default)
  if (def.length > 0) return { tier: 'default' as const, list: def }
  return { tier: 'none' as const, list: [] }
})

function close() {
  emit('update:open', false)
}

// 阻止面板内点击冒泡触发关闭
function stopProp(e: Event) {
  e.stopPropagation()
}

// ESC 关闭
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="tts-fade">
      <div v-if="open" class="tts-overlay" @click.self="close">
        <div class="tts-panel" @click="stopProp" role="dialog" aria-label="TTS 设置">
          <header class="tts-header">
            <h3>🔊 TTS 设置 & 诊断</h3>
            <button class="tts-close" @click="close" aria-label="关闭">✕</button>
          </header>

          <div class="tts-body">
            <!-- 状态/诊断 -->
            <section class="tts-section">
              <h4>① 状态 / 诊断</h4>
              <div class="tts-grid">
                <div class="tts-cell">
                  <span class="lbl">Web Speech API</span>
                  <span :class="['val', supported ? 'ok' : 'bad']">
                    {{ supported ? '✓ 支持' : '✗ 不支持' }}
                  </span>
                </div>
                <div class="tts-cell">
                  <span class="lbl">voices 已加载</span>
                  <span :class="['val', voices.length > 0 ? 'ok' : 'warn']">
                    {{ voices.length }}
                  </span>
                </div>
                <div class="tts-cell">
                  <span class="lbl">当前状态</span>
                  <span :class="['val', speaking ? 'ok' : (pending ? 'warn' : '') ]">
                    <template v-if="speaking">▶ 朗读中</template>
                    <template v-else-if="pending">⏳ 排队中</template>
                    <template v-else-if="paused">⏸ 已暂停</template>
                    <template v-else>○ 闲置</template>
                  </span>
                </div>
                <div class="tts-cell">
                  <span class="lbl">最近朗读</span>
                  <span class="val mono">
                    <template v-if="lastSpoken">
                      "{{ lastSpoken.text.slice(0, 20) }}{{ lastSpoken.text.length > 20 ? '…' : '' }}"
                      <span class="ts">{{ new Date(lastSpoken.at).toLocaleTimeString() }}</span>
                    </template>
                    <template v-else>—</template>
                  </span>
                </div>
              </div>
              <div v-if="error" class="tts-err">⚠ {{ error }}</div>
              <details class="tts-diag">
                <summary>浏览器 / UA</summary>
                <code>{{ userAgent }}</code>
              </details>
            </section>

            <!-- 声音选择 -->
            <section class="tts-section">
              <h4>② 声音（Voice）</h4>
              <p class="tts-hint">不选则按 lang 自动匹配；选「自动」=保持上次行为。</p>
              <div class="tts-row">
                <label>Lang（BCP47）</label>
                <input
                  type="text"
                  :value="settings.lang"
                  @input="update({ lang: ($event.target as HTMLInputElement).value || 'en-US' })"
                  placeholder="en-US / en-GB / zh-CN …"
                />
              </div>
              <div class="tts-row">
                <label>Voice URI</label>
                <select
                  :value="settings.voiceURI ?? ''"
                  @change="update({ voiceURI: ($event.target as HTMLSelectElement).value || null })"
                >
                  <option value="">— 自动（按 lang 匹配）—</option>
                  <optgroup v-for="g in groupedVoices" :key="g.lang" :label="g.lang">
                    <option v-for="v in g.items" :key="v.voiceURI" :value="v.voiceURI">
                      {{ v.name }}{{ v.localService ? ' (本地)' : ' (在线)' }}{{ v.default ? ' ★' : '' }}
                    </option>
                  </optgroup>
                </select>
              </div>
              <div class="tts-row">
                <label>筛选</label>
                <input v-model="voiceFilter" placeholder="按 lang 或 name 过滤（如 en、David）" />
              </div>

              <!-- 匹配当前 lang 的 voice（这就是朗读时实际会用到的） -->
              <div class="tts-match" :class="`tier-${matchedVoices.tier}`">
                <template v-if="matchedVoices.tier === 'exact'">
                  ✓ 完全匹配 lang="{{ settings.lang }}" 的 voice：<strong>{{ matchedVoices.list.length }}</strong> 个
                  <span class="tts-match-list">
                    <span v-for="v in matchedVoices.list" :key="v.voiceURI" class="tag">{{ v.name }}</span>
                  </span>
                </template>
                <template v-else-if="matchedVoices.tier === 'partial'">
                  ⚠ 没有 lang="{{ settings.lang }}" 的 voice；<strong>用前缀 {{ settings.lang.split('-')[0] }} 兜底：</strong>{{ matchedVoices.list.length }} 个
                  <span class="tts-match-list">
                    <span v-for="v in matchedVoices.list" :key="v.voiceURI" class="tag">{{ v.name }} ({{ v.lang }})</span>
                  </span>
                </template>
                <template v-else-if="matchedVoices.tier === 'default'">
                  ⚠ 没有 lang="{{ settings.lang }}" 的 voice；用 <strong>系统默认 voice</strong>（{{ matchedVoices.list[0]?.name }}）兜底
                </template>
                <template v-else>
                  <strong>❌ 完全找不到 voice</strong>。可能原因：
                  <ul class="tts-fix">
                    <li>系统未安装 TTS 引擎（Windows: 设置 → 时间和语言 → 语言 → {{ settings.lang }} → 语音 → 添加语音）</li>
                    <li>改 Lang 为系统已安装的语言（如「zh-CN」），或在上方 Voice URI 下拉里手动选一个</li>
                    <li>如果 Chromium 内核，flags 里可启用 <code>--enable-speech-dispatcher</code>（Linux）</li>
                  </ul>
                </template>
              </div>

              <details v-if="voices.length > 0" class="tts-diag">
                <summary>所有 voices 列表（{{ voices.length }}）</summary>
                <table class="tts-voice-table">
                  <thead>
                    <tr><th>name</th><th>lang</th><th>localService</th><th>default</th><th>voiceURI</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="v in voices" :key="v.voiceURI">
                      <td>{{ v.name }}</td>
                      <td>{{ v.lang }}</td>
                      <td>{{ v.localService ? '✓' : '' }}</td>
                      <td>{{ v.default ? '✓' : '' }}</td>
                      <td class="mono small">{{ v.voiceURI }}</td>
                    </tr>
                  </tbody>
                </table>
              </details>
            </section>

            <!-- 参数 -->
            <section class="tts-section">
              <h4>③ 参数</h4>
              <div class="tts-row slider">
                <label>语速 rate <span class="val-num">{{ settings.rate.toFixed(2) }}</span></label>
                <input
                  type="range" min="0.1" max="2" step="0.05"
                  :value="settings.rate"
                  @input="update({ rate: Number(($event.target as HTMLInputElement).value) })"
                />
              </div>
              <div class="tts-row slider">
                <label>音调 pitch <span class="val-num">{{ settings.pitch.toFixed(2) }}</span></label>
                <input
                  type="range" min="0" max="2" step="0.05"
                  :value="settings.pitch"
                  @input="update({ pitch: Number(($event.target as HTMLInputElement).value) })"
                />
              </div>
              <div class="tts-row slider">
                <label>音量 volume <span class="val-num">{{ settings.volume.toFixed(2) }}</span></label>
                <input
                  type="range" min="0" max="1" step="0.05"
                  :value="settings.volume"
                  @input="update({ volume: Number(($event.target as HTMLInputElement).value) })"
                />
              </div>
            </section>

            <!-- 测试 -->
            <section class="tts-section">
              <h4>④ 测试朗读</h4>
              <textarea v-model="testText" rows="3" class="tts-test-input"></textarea>
              <div class="tts-test-buttons">
                <button class="btn-primary" @click="speak(testText)" :disabled="!supported || !testText">▶ 用当前设置朗读</button>
                <button @click="pause" :disabled="!speaking || paused">⏸ 暂停</button>
                <button @click="resume" :disabled="!paused">▶ 继续</button>
                <button @click="stop">⏹ 停止</button>
                <button class="btn-secondary" @click="reset">↺ 恢复默认</button>
              </div>
            </section>
          </div>

          <footer class="tts-footer">
            <span class="tts-hint">设置自动保存到 localStorage（key: <code>tts-settings-v1</code>）</span>
            <button class="btn-primary" @click="close">完成</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tts-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.tts-panel {
  background: #fff;
  color: #1a1a2e;
  border-radius: 12px;
  width: min(720px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.tts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #eee;
  background: #1a1a2e;
  color: #fff;
}
.tts-header h3 { margin: 0; font-size: 16px; }
.tts-close {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  width: 28px; height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.tts-close:hover { background: rgba(255,255,255,0.15); }
.tts-body {
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}
.tts-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: #1a1a2e;
  text-transform: none;
  font-weight: bold;
}
.tts-hint { color: #666; font-size: 12px; margin: 0 0 8px; }
.tts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.tts-cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 6px 10px;
  background: #f7f7fa;
  border-radius: 6px;
}
.tts-cell .lbl { color: #555; }
.tts-cell .val { font-weight: bold; }
.tts-cell .val.ok { color: #2e7d32; }
.tts-cell .val.bad { color: #c62828; }
.tts-cell .val.warn { color: #ef6c00; }
.tts-cell .val.mono { font-family: monospace; font-weight: normal; font-size: 12px; }
.tts-cell .ts { color: #999; font-size: 11px; margin-left: 6px; }
.tts-err {
  margin-top: 8px;
  padding: 8px 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 6px;
  font-size: 12px;
  word-break: break-all;
}
.tts-diag {
  margin-top: 8px;
  font-size: 12px;
}
.tts-diag summary {
  cursor: pointer;
  color: #1a1a2e;
  user-select: none;
  padding: 4px 0;
}
.tts-diag code {
  display: block;
  margin-top: 6px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
  white-space: pre-wrap;
}
.tts-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.tts-row > label {
  flex: 0 0 120px;
  font-size: 13px;
  color: #555;
}
.tts-row > input,
.tts-row > select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}
.tts-row.slider > input { flex: 1; }
.tts-row.slider .val-num {
  flex: 0 0 50px;
  text-align: right;
  font-family: monospace;
  font-size: 12px;
  color: #1a1a2e;
}
.tts-voice-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-top: 6px;
}
.tts-match {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}
.tts-match.tier-partial {
  background: #fff3e0;
  color: #ef6c00;
  border-color: #ffe0b2;
}
.tts-match.tier-default,
.tts-match.tier-none {
  background: #ffebee;
  color: #c62828;
  border-color: #ffcdd2;
}
.tts-match-list {
  display: block;
  margin-top: 6px;
}
.tts-match-list .tag {
  display: inline-block;
  background: rgba(0, 0, 0, 0.08);
  color: inherit;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  margin: 2px 4px 2px 0;
}
.tts-fix {
  margin: 6px 0 0 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.7;
}
.tts-fix code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
}
.tts-voice-table th,
.tts-voice-table td {
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid #eee;
}
.tts-voice-table th { background: #f5f5f5; font-weight: bold; }
.tts-voice-table .mono { font-family: monospace; }
.tts-voice-table .small { font-size: 10px; color: #666; }
.tts-test-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}
.tts-test-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.tts-test-buttons button {
  padding: 6px 14px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.tts-test-buttons button:hover:not(:disabled) { background: #f5f5f5; }
.tts-test-buttons button:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary {
  background: #1a1a2e !important;
  color: #fff !important;
  border-color: #1a1a2e !important;
}
.btn-primary:hover:not(:disabled) { background: #2d3a5e !important; }
.btn-secondary { color: #1a1a2e !important; }
.tts-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #eee;
  background: #fafafa;
  font-size: 12px;
  color: #666;
}
.tts-footer code { background: #eee; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
.tts-fade-enter-active, .tts-fade-leave-active { transition: opacity 0.2s; }
.tts-fade-enter-from, .tts-fade-leave-to { opacity: 0; }
@media (prefers-color-scheme: dark) {
  .tts-panel { background: #1c1c20; color: #e6e6e6; }
  .tts-section h4, .tts-cell .val, .tts-row > label, .tts-diag summary { color: #e6e6e6; }
  .tts-cell { background: #25252a; }
  .tts-cell .lbl { color: #aaa; }
  .tts-row > input, .tts-row > select { background: #202024; color: #e6e6e6; border-color: #444; }
  .tts-diag code { background: #202024; color: #aaa; }
  .tts-voice-table th { background: #25252a; }
  .tts-voice-table td { border-bottom-color: #2a2a2d; }
  .tts-test-input { background: #202024; color: #e6e6e6; border-color: #444; }
  .tts-test-buttons button { background: #202024; color: #e6e6e6; border-color: #444; }
  .tts-test-buttons button:hover:not(:disabled) { background: #2a2a2d; }
  .tts-footer { background: #202024; border-top-color: #2a2a2d; color: #aaa; }
  .tts-header { background: #0e0e10; }
  .tts-match { background: #1f3a23; color: #a5d6a7; border-color: #2e4a32; }
  .tts-match.tier-partial { background: #3a2c14; color: #ffcc80; border-color: #5a4220; }
  .tts-match.tier-default,
  .tts-match.tier-none { background: #3a1f23; color: #ef9a9a; border-color: #5a2a30; }
  .tts-match-list .tag { background: rgba(255,255,255,0.08); }
  .tts-fix code { background: rgba(255,255,255,0.08); }
}
</style>
