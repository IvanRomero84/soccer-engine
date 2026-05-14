/**
 * @file user.ts
 * Interfaces para el perfil de usuario y preferencias en Firestore.
 */

export interface UserPreferences {
  /** ID del equipo favorito (Football-Data.org team ID) */
  favoriteClubId?: number
  favoriteClubName?: string
  favoriteClubLogo?: string
  /** IDs de ligas seguidas */
  followedLeagues?: number[]
  /** Tema visual preferido */
  theme?: 'dark' | 'light' | 'system'
  /** Idioma preferido */
  language?: 'es' | 'en'
  /** Preferencias de notificación */
  notifs?: {
    matchStart: boolean
    goals: boolean
    matchEnd: boolean
  }
}

export interface AppUser {
  /** UID de Firebase */
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  /** Proveedor: 'password' | 'google.com' | 'facebook.com' */
  providerId: string
  preferences: UserPreferences
  /** Fecha de creación de la cuenta (ISO 8601) */
  createdAt: string
  /** Última conexión */
  lastLoginAt: string
}
