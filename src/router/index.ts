import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/leagues',
      name: 'leagues',
      component: () => import('@/views/LeaguesView.vue'),
    },
    {
      path: '/leagues/:id',
      name: 'league-detail',
      component: () => import('@/views/LeagueDetailView.vue'),
      props: true,
    },
    {
      path: '/club/:id',
      name: 'club-detail',
      component: () => import('@/views/ClubDetailView.vue'),
      props: true,
    },
    {
      path: '/live',
      name: 'live',
      component: () => import('@/views/LiveView.vue'),
    },
    {
      path: '/match/:id',
      name: 'match-detail',
      component: () => import('@/views/MatchDetailView.vue'),
      props: true,
      meta: { transition: 'slide' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

// Navigation guard
router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Esperar a que Firebase inicialice
  if (!authStore.isInitialized) {
    await new Promise<void>((resolve) => {
      const unwatch = setInterval(() => {
        if (authStore.isInitialized) {
          clearInterval(unwatch)
          resolve()
        }
      }, 50)
    })
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'home' }
  }
})

export default router
