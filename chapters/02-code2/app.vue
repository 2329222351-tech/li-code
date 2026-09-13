<script setup lang="ts">
const config = useRuntimeConfig()
const appName = config.public.appName
</script>

<template>
  <div>
    <header class="topnav">
      <span class="brand">{{ appName }}</span>
      <nav>
        <NuxtLink to="/" exact-active-class="active">游戏</NuxtLink>
        <NuxtLink to="/review" active-class="active">词库校验</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>

<style>
:root {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
  color-scheme: light dark;
}
body {
  margin: 0;
  background: #fafafa;
  color: #111;
}
@media (prefers-color-scheme: dark) {
  body { background: #0e0e10; color: #e6e6e6; }
}
.topnav {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: #1a1a2e;
  color: #eee;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.topnav .brand { font-weight: bold; font-size: 16px; }
.topnav nav { display: flex; gap: 8px; }
.topnav a {
  color: #aab;
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.15s;
}
.topnav a:hover { background: rgba(255,255,255,0.08); color: #fff; }
.topnav a.active { background: #2d3a5e; color: #fff; }
</style>
