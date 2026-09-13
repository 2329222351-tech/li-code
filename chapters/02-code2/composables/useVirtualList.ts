// app/composables/useVirtualList.ts
// 轻量级固定行高窗口化虚拟列表 composable
// 用法：
//   const { setContainer, items, totalHeight, onScroll, scrollTo } = useVirtualList({
//     items: myList,           // Ref<T[]>
//     itemHeight: 28,
//     overscan: 8
//   })
// 模板里：
//   <div :ref="setContainer" @scroll="onScroll"
//        style="overflow-y: auto; height: 600px">
//     <div :style="{ height: totalHeight + 'px', position: 'relative' }">
//       <div v-for="entry in items" :key="entry.index"
//            :style="{ position: 'absolute', top: entry.top + 'px',
//                      left: 0, right: 0, height: itemHeight + 'px' }">
//         {{ entry.item }}
//       </div>
//     </div>
//   </div>

import { ref, computed, onBeforeUnmount, onActivated, type Ref, type ComponentPublicInstance } from 'vue'

export interface VirtualEntry<T> {
  item: T
  index: number          // 原始列表里的绝对 index
  top: number            // 像素位置（相对滚动容器内的占位 div）
}

export interface UseVirtualListOptions<T> {
  items: Ref<T[]>
  itemHeight: number
  overscan?: number
}

export function useVirtualList<T>(opts: UseVirtualListOptions<T>) {
  // scrollTop / viewportHeight 用普通 let + version ref：
  // 让 scroll/resize 回调里同步立刻更新值（避免 ref 的 RAF 写入窗口期
  // 出现「用户滚到 accept 位置，但 visibleItems 仍按 scrollTop=0 渲染前 38 条」的过期 bug）。
  let scrollTopVal = 0
  let viewportHeightVal = 0
  const version = ref(0)
  function bump() {
    version.value++
  }

  // 容器元素（也对外暴露为 ref，方便外部代码读）
  const containerRef = ref<HTMLElement | null>(null)

  // 模板里 :ref="setContainer" —— Vue 会在 mount/unmount 时同步调用，
  // 时序确定，不依赖 watch 的 flush 策略，也不依赖「onScroll 异步路径下 ref 还没设上」。
  let ro: ResizeObserver | null = null
  function setContainer(el: Element | ComponentPublicInstance | null) {
    if (ro) {
      ro.disconnect()
      ro = null
    }
    if (!el || !(el instanceof HTMLElement)) {
      containerRef.value = null
      scrollTopVal = 0
      viewportHeightVal = 0
      bump()
      return
    }
    containerRef.value = el
    viewportHeightVal = el.clientHeight
    scrollTopVal = el.scrollTop
    bump()
    ro = new ResizeObserver(() => {
      if (!containerRef.value) return
      const h = containerRef.value.clientHeight
      if (h !== viewportHeightVal) {
        viewportHeightVal = h
        bump()
      }
    })
    ro.observe(el)
  }

  const overscan = opts.overscan ?? 6

  let raf = 0
  function onScroll() {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (containerRef.value) {
        const newTop = containerRef.value.scrollTop
        if (newTop !== scrollTopVal) {
          scrollTopVal = newTop
          bump()
        }
      }
    })
  }

  // keep-alive 激活时再量一次高度
  onActivated(() => {
    if (containerRef.value) {
      viewportHeightVal = containerRef.value.clientHeight
      bump()
    }
  })

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    if (ro) ro.disconnect()
  })

  const totalHeight = computed(() => opts.items.value.length * opts.itemHeight)

  // 立刻同步反映最新 scrollTop / viewportHeight。读 version.value 是为了让
  // computed 在 scrollTopVal 改变后能感知到（ref 是响应式触发源）。
  const visibleItems = computed<VirtualEntry<T>[]>(() => {
    void version.value
    const len = opts.items.value.length
    if (len === 0) return []
    const vh = viewportHeightVal
    const effectiveVh = vh > 0 ? vh : 600
    const start = Math.max(0, Math.floor(scrollTopVal / opts.itemHeight) - overscan)
    const visibleCount = Math.ceil(effectiveVh / opts.itemHeight) + overscan * 2
    const end = Math.min(len, start + visibleCount)
    const out: VirtualEntry<T>[] = []
    for (let i = start; i < end; i++) {
      out.push({ item: opts.items.value[i], index: i, top: i * opts.itemHeight })
    }
    return out
  })

  function scrollTo(index: number) {
    if (!containerRef.value) return
    const top = Math.max(0, index * opts.itemHeight)
    containerRef.value.scrollTop = top
    // 同步本地状态，避免 scroll 事件没及时触发导致渲染延迟
    if (top !== scrollTopVal) {
      scrollTopVal = top
      bump()
    }
  }

  return {
    setContainer,         // 模板 :ref="setContainer" 绑定
    containerRef,         // 暴露 ref 供外部按需读
    items: visibleItems,
    totalHeight,
    onScroll,
    scrollTo
  }
}
