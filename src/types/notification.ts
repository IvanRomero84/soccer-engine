export type NotificationType = 'match_start' | 'goal' | 'match_end' | 'news' | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
  link?: string
  data?: any
}

export interface NotificationPreferences {
  matchStart: boolean
  goals: boolean
  matchEnd: boolean
  news: boolean
}
