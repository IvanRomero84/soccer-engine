<template>
  <div id="app-root">
    <AppNavBar />
    <main class="main-content">
      <RouterView v-slot="{ Component, route }">
        <Transition :name="route.meta.transition as string || 'page'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppNavBar from '@/components/layout/AppNavBar.vue'
</script>

<style>
/* ── App shell ── */
#app-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--color-bg-base);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ── Route transitions ── */
.page-enter-active {
  animation: page-in 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
.page-leave-active {
  animation: page-out 0.2s cubic-bezier(0.55, 0, 1, 0.45) forwards;
}

@keyframes page-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes page-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}

/* Slide lateral para sub-rutas */
.slide-enter-active,
.slide-leave-active { transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.slide-enter-from   { opacity: 0; transform: translateX(24px); }
.slide-leave-to     { opacity: 0; transform: translateX(-24px); }
</style>
