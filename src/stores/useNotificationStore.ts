import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppNotification } from '@/types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<AppNotification[]>([])
  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  function addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false
    }
    notifications.value.unshift(newNotification)
    
    // Play sound or show toast if needed
    if (Notification.permission === 'granted') {
      // Browser notification
    }
  }

  function markAsRead(id: string) {
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
  }

  function markAllAsRead() {
    notifications.value.forEach(n => n.read = true)
  }

  function clearNotifications() {
    notifications.value = []
  }

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  }
})
