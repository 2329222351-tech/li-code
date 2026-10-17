<script setup lang="ts">
const config = useRuntimeConfig()
const appName = config.public.appName
</script>

<template>
  <div class="shell">
    <header class="topnav">
      <NuxtLink to="/" class="brand">
        <span class="mark">手</span>
        <span>{{ appName }}</span>
      </NuxtLink>
      <nav>
        <NuxtLink to="/" exact-active-class="active">题库</NuxtLink>
        <NuxtLink to="/recite" active-class="active">背诵</NuxtLink>
        <NuxtLink to="/progress" active-class="active">进度</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>

<style>
:root {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
  color-scheme: light dark;

  /* 设计令牌 —— 浅色 */
  --bg: #f7f8fa;
  --surface: #ffffff;
  --surface-2: #f2f3f7;
  --surface-3: #e9ebf2;
  --border: #e4e6ee;
  --border-strong: #d3d6e0;
  --text: #14161c;
  --text-soft: #3c414d;
  --muted: #6b7280;
  --faint: #9aa1ae;
  --brand: #1a1a2e;
  --brand-2: #2d3a5e;
  --accent: #2d4a8a;
  --accent-soft: #eaeeff;
  --ok: #15803d;
  --ok-soft: #e8f6ec;
  --bad: #b91c1c;
  --bad-soft: #fdeceb;
  --warn: #b45309;
  --warn-soft: #fdf4e4;
  --shadow: 0 1px 2px rgba(16, 18, 28, 0.04), 0 8px 24px rgba(16, 18, 28, 0.06);
  --radius: 14px;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; }

.shell { min-height: 100vh; }

.topnav {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 12px 28px;
  background: var(--brand);
  color: #eeeff5;
  position: sticky;
  top: 0;
  z-index: 20;
}
.topnav .brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  letter-spacing: 0.02em;
}
.topnav .mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #ffffff;
  color: var(--brand);
  font-size: 13px;
  font-weight: 800;
}
.topnav nav { display: flex; gap: 4px; }
.topnav nav a {
  color: #b9bdd0;
  text-decoration: none;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}
.topnav nav a:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.topnav nav a.active { background: var(--brand-2); color: #fff; }

.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 72px;
}
.page.narrow { max-width: 760px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s, opacity 0.15s;
}
.btn:hover:not(:disabled) { background: var(--surface-2); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.btn.primary:hover:not(:disabled) { background: var(--brand-2); }
.btn.ghost { background: transparent; border-color: transparent; color: var(--muted); }
.btn.ghost:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
.btn.sm { padding: 7px 13px; font-size: 13px; border-radius: 8px; }
.btn.danger { color: var(--bad); border-color: var(--bad); background: transparent; }
.btn.danger:hover:not(:disabled) { background: var(--bad-soft); }

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  font-weight: 600;
}

kbd {
  display: inline-block;
  min-width: 18px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  color: var(--text-soft);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
}
/* 深色按钮里的按键提示要反色，否则灰底灰字几乎看不见 */
.btn.primary kbd {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e0e11;
    --surface: #17171c;
    --surface-2: #1e1e25;
    --surface-3: #26262f;
    --border: #2a2a34;
    --border-strong: #3a3a46;
    --text: #e9e9f0;
    --text-soft: #cdd0da;
    --muted: #9aa0ab;
    --faint: #7b8290;
    --brand: #12121a;
    --brand-2: #2b3450;
    --accent: #8aa7f0;
    --accent-soft: #1b2340;
    --ok: #4ade80;
    --ok-soft: #14261a;
    --bad: #f87171;
    --bad-soft: #2a1616;
    --warn: #fbbf24;
    --warn-soft: #2a2213;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
  }
  .topnav { border-bottom: 1px solid var(--border); }
  .topnav .mark { background: #ffffff; color: #12121a; }
  .btn.primary { background: #2b3450; border-color: #3a4668; }
  .btn.primary:hover:not(:disabled) { background: #3a4668; }
}
</style>
