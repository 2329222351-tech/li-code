<script setup lang="ts">
// 圆环进度指示器：纯 SVG，无依赖。
// value 为 0-100 的百分比；track 用 --surface-3，进度用 --accent。

const props = withDefaults(defineProps<{
  value: number
  size?: number
  stroke?: number
  label?: string
  caption?: string
}>(), {
  size: 136,
  stroke: 10,
  label: '',
  caption: ''
})

const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const clamped = computed(() => Math.min(100, Math.max(0, Number.isFinite(props.value) ? props.value : 0)))
const offset = computed(() => circumference.value * (1 - clamped.value / 100))
</script>

<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="`进度 ${Math.round(clamped)}%`">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--surface-3)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--accent)"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        class="value"
      />
    </svg>
    <div class="inner">
      <div class="num">{{ label || `${Math.round(clamped)}%` }}</div>
      <div v-if="caption" class="cap">{{ caption }}</div>
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
}
svg { display: block; }
.value { transition: stroke-dashoffset 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
.inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.num {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.1;
  color: var(--text);
}
.cap {
  font-size: 12px;
  color: var(--muted);
}
</style>
