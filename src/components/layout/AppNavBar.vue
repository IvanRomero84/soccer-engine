<template>
  <header class="navbar" :class="{ 'navbar--scrolled': scrolled }">
    <div class="navbar__inner container">
      <!-- Logo -->
      <RouterLink to="/" class="navbar__logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="14" cy="14" r="13" stroke="#3b82f6" stroke-width="2"/>
          <polygon points="14,5 17,11 23,11 18,15 20,21 14,17 8,21 10,15 5,11 11,11" fill="#3b82f6" opacity="0.85"/>
        </svg>
        <span class="navbar__logo-text">Soccer<em>Engine</em></span>
      </RouterLink>

      <!-- Nav links — desktop -->
      <nav class="navbar__links" aria-label="Navegación principal">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="navbar__link"
          active-class="navbar__link--active"
        >
          <component :is="link.icon" class="nav-icon" />
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>

      <!-- Right slot: auth + menu toggle -->
      <div class="navbar__right">
        <!-- Notification Hub -->
        <div v-if="authStore.isAuthenticated" class="notif-hub">
          <button class="notif-btn" @click="toggleNotifs" :aria-expanded="notifsOpen">
            <component :is="IconBell" class="nav-icon" />
            <span v-if="notifStore.unreadCount > 0" class="notif-badge">{{ notifStore.unreadCount }}</span>
          </button>
          
          <Transition name="fade">
            <div v-if="notifsOpen" class="notif-dropdown card">
              <div class="notif-dropdown__header">
                <h3>Notificaciones</h3>
                <button @click="notifStore.markAllAsRead" class="text-link text-xs">Marcar todas como leídas</button>
              </div>
              <div class="notif-dropdown__list">
                <div v-for="n in notifStore.notifications" :key="n.id" class="notif-item" :class="{ 'notif-item--unread': !n.read }" @click="handleNotifClick(n)">
                  <div class="notif-item__icon" :class="`notif-icon--${n.type}`"></div>
                  <div class="notif-item__content">
                    <p class="notif-item__title">{{ n.title }}</p>
                    <p class="notif-item__msg">{{ n.message }}</p>
                    <span class="notif-item__time">{{ formatTime(n.timestamp) }}</span>
                  </div>
                </div>
                <div v-if="notifStore.notifications.length === 0" class="notif-empty">
                  No tienes notificaciones.
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Live indicator -->
        <RouterLink to="/live" class="live-pill" aria-label="Ver partidos en vivo">
          <span class="live-dot"></span>
          <span>EN VIVO</span>
        </RouterLink>

        <!-- Auth button -->
        <RouterLink
          v-if="!authStore.isAuthenticated"
          to="/auth"
          class="btn btn-primary btn--sm"
        >
          Entrar
        </RouterLink>
        <button v-else class="avatar-btn" @click="toggleUserMenu" :aria-expanded="userMenuOpen">
          <img
            v-if="authStore.currentUser?.photoURL"
            :src="authStore.currentUser.photoURL"
            :alt="authStore.userDisplayName"
            class="avatar"
          />
          <span v-else class="avatar avatar--initials">
            {{ initials }}
          </span>
        </button>

        <!-- User dropdown -->
        <Transition name="fade">
          <div v-if="userMenuOpen" class="user-menu" role="menu" @click.self="userMenuOpen = false">
            <div class="user-menu__header">
              <p class="user-menu__name">{{ authStore.userDisplayName }}</p>
              <p class="user-menu__email text-muted">{{ authStore.currentUser?.email }}</p>
            </div>
            <div class="user-menu__divider"></div>
            <RouterLink to="/profile" class="user-menu__item" @click="userMenuOpen = false">
              Mi Perfil
            </RouterLink>
            <button class="user-menu__item user-menu__item--danger" @click="handleLogout">
              Cerrar Sesión
            </button>
          </div>
        </Transition>

        <!-- Hamburger — mobile -->
        <button
          class="hamburger"
          :class="{ 'hamburger--open': mobileOpen }"
          @click="mobileOpen = !mobileOpen"
          :aria-expanded="mobileOpen"
          aria-label="Menú"
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>

    <!-- Mobile menu -->
    <Transition name="slide-up">
      <nav v-if="mobileOpen" class="mobile-menu" aria-label="Menú móvil">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="mobile-menu__link"
          active-class="mobile-menu__link--active"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <div class="mobile-menu__divider"></div>
        <RouterLink v-if="!authStore.isAuthenticated" to="/auth" class="mobile-menu__link" @click="mobileOpen = false">
          Iniciar Sesión
        </RouterLink>
        <button v-else class="mobile-menu__link mobile-menu__link--danger" @click="handleLogout">
          Cerrar Sesión
        </button>
      </nav>
    </Transition>
  </header>

  <!-- Overlay for user menu / mobile -->
  <div
    v-if="userMenuOpen || mobileOpen"
    class="nav-overlay"
    @click="userMenuOpen = false; mobileOpen = false"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineComponent, h } from 'vue'
import { useAuthStore, useNotificationStore } from '@/stores'

const authStore = useAuthStore()
const notifStore = useNotificationStore()

// ── Scroll state ──────────────────────────────────────────────────────────────
const scrolled = ref(false)
function onScroll() { scrolled.value = window.scrollY > 16 }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

// ── Menus ─────────────────────────────────────────────────────────────────────
const mobileOpen = ref(false)
const userMenuOpen = ref(false)
function toggleUserMenu() { userMenuOpen.value = !userMenuOpen.value }
async function handleLogout() {
  await authStore.logout()
  userMenuOpen.value = false
  mobileOpen.value = false
}

// ── User initials ─────────────────────────────────────────────────────────────
const initials = computed(() => {
  const name = authStore.userDisplayName
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
})

const notifsOpen = ref(false)
function toggleNotifs() { notifsOpen.value = !notifsOpen.value }

function formatTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function handleNotifClick(n: any) {
  notifStore.markAsRead(n.id)
  if (n.link) {
    // router.push(n.link)
  }
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IconHome = defineComponent({ render: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'nav-icon' }, [
  h('path', { d: 'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4a1 1 0 001-1v-3h2v3a1 1 0 001 1h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z' })
]) })

const IconLeague = defineComponent({ render: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'nav-icon' }, [
  h('path', { d: 'M9 2a1 1 0 000 2h2a1 1 0 100-2H9z' }),
  h('path', { 'fill-rule': 'evenodd', d: 'M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z', 'clip-rule': 'evenodd' })
]) })

const IconLive = defineComponent({ render: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'nav-icon' }, [
  h('path', { 'fill-rule': 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z', 'clip-rule': 'evenodd' })
]) })

const IconBell = defineComponent({ render: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'nav-icon' }, [
  h('path', { d: 'M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z' })
]) })

const navLinks = [
  { to: '/',        label: 'Dashboard',  icon: IconHome },
  { to: '/leagues', label: 'Ligas',      icon: IconLeague },
  { to: '/live',    label: 'En Vivo',    icon: IconLive },
]
</script>

<style scoped>
/* ── Navbar shell ─────────────────────────────────────────────────────────── */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--nav-height);
  background: rgba(8, 12, 20, 0.75);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
}
.navbar--scrolled {
  background: rgba(8, 12, 20, 0.95);
  border-bottom-color: var(--color-border);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.navbar__inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

/* ── Logo ─────────────────────────────────────────────────────────────────── */
.navbar__logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}
.navbar__logo-text {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}
.navbar__logo-text em {
  font-style: normal;
  color: var(--color-accent);
}

/* ── Nav links ───────────────────────────────────────────────────────────── */
.navbar__links {
  display: none;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}
@media (min-width: 768px) { .navbar__links { display: flex; } }

.navbar__link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
}
.navbar__link:hover {
  color: var(--color-text-primary);
  background: var(--color-accent-muted);
}
.navbar__link--active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
}
.nav-icon { width: 16px; height: 16px; flex-shrink: 0; }

/* ── Right section ───────────────────────────────────────────────────────── */
.navbar__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

/* ── Live pill ───────────────────────────────────────────────────────────── */
.live-pill {
  display: none;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-red-muted);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--color-red);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: all var(--transition-fast);
}
.live-pill:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-red);
}
@media (min-width: 640px) { .live-pill { display: flex; } }

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-red);
  animation: pulse-dot 1.5s infinite;
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
.avatar-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong);
  object-fit: cover;
  transition: border-color var(--transition-fast);
}
.avatar-btn:hover .avatar { border-color: var(--color-accent); }
.avatar--initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-accent-muted);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 700;
}

/* ── User dropdown ───────────────────────────────────────────────────────── */
.user-menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 220px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.user-menu__header { padding: var(--space-4); }
.user-menu__name { font-weight: 600; font-size: 0.9rem; }
.user-menu__email { font-size: 0.8rem; margin-top: 2px; }
.user-menu__divider { height: 1px; background: var(--color-border); }
.user-menu__item {
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  text-decoration: none;
  transition: all var(--transition-fast);
}
.user-menu__item:hover {
  background: var(--color-accent-muted);
  color: var(--color-text-primary);
}
.user-menu__item--danger:hover {
  background: var(--color-red-muted);
  color: var(--color-red);
}

/* ── btn size ────────────────────────────────────────────────────────────── */
.btn--sm { padding: var(--space-2) var(--space-4); font-size: 0.8rem; }

/* ── Hamburger ───────────────────────────────────────────────────────────── */
.hamburger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
}
@media (min-width: 768px) { .hamburger { display: none; } }

.hamburger span {
  display: block;
  height: 2px;
  background: var(--color-text-secondary);
  border-radius: 2px;
  transition: all var(--transition-base);
  transform-origin: center;
}
.hamburger--open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger--open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger--open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ── Mobile menu ─────────────────────────────────────────────────────────── */
.mobile-menu {
  position: fixed;
  top: var(--nav-height);
  left: 0;
  right: 0;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  z-index: 99;
}
.mobile-menu__link {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.mobile-menu__link:hover,
.mobile-menu__link--active { background: var(--color-accent-muted); color: var(--color-accent); }
.mobile-menu__link--danger:hover { background: var(--color-red-muted); color: var(--color-red); }
.mobile-menu__divider { height: 1px; background: var(--color-border); margin: var(--space-2) 0; }

/* ── Overlay ─────────────────────────────────────────────────────────────── */
.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 98;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
}

/* ── Notifications ───────────────────────────────────────────────────────── */
.notif-hub { position: relative; }
.notif-btn { background: none; border: none; cursor: pointer; color: var(--color-text-secondary); padding: 8px; position: relative; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.notif-btn:hover { background: var(--color-bg-elevated); color: var(--color-text-primary); }
.notif-badge { position: absolute; top: 4px; right: 4px; background: var(--color-red); color: white; font-size: 0.6rem; font-weight: 700; min-width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--color-bg-surface); }

.notif-dropdown { position: absolute; top: calc(100% + 12px); right: -100px; width: 300px; max-height: 400px; display: flex; flex-direction: column; overflow: hidden; z-index: 101; }
.notif-dropdown__header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); }
.notif-dropdown__header h3 { font-size: 0.9rem; font-weight: 600; }
.notif-dropdown__list { overflow-y: auto; flex: 1; }
.notif-item { padding: 12px 16px; display: flex; gap: 12px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid var(--color-border); }
.notif-item:hover { background: var(--color-bg-elevated); }
.notif-item--unread { background: rgba(59, 130, 246, 0.05); }
.notif-item__icon { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.notif-icon--goal { background: var(--color-green); }
.notif-icon--match_start { background: var(--color-accent); }
.notif-item__title { font-size: 0.85rem; font-weight: 600; margin-bottom: 2px; }
.notif-item__msg { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4; }
.notif-item__time { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 4px; display: block; }
.notif-empty { padding: 32px; text-align: center; color: var(--color-text-muted); font-size: 0.85rem; }

.text-xs { font-size: 0.75rem; }
.text-link { background: none; border: none; color: var(--color-accent); cursor: pointer; padding: 0; }
</style>
