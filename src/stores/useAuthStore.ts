/**
 * @file useAuthStore.ts
 * Store de Pinia para autenticación Firebase + preferencias en Firestore.
 *
 * Si Firebase no está configurado (isFirebaseConfigured = false),
 * todas las acciones de auth devuelven errores controlados
 * y la app funciona en modo "invitado".
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import {
  auth,
  db,
  googleProvider,
  facebookProvider,
  isFirebaseConfigured,
} from '@/services/firebase'
import type { AppUser, UserPreferences } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapFirebaseUser(
  firebaseUser: FirebaseUser,
  preferences: UserPreferences = {},
): AppUser {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    providerId: firebaseUser.providerData[0]?.providerId ?? 'password',
    preferences,
    createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
    lastLoginAt: firebaseUser.metadata.lastSignInTime ?? new Date().toISOString(),
  }
}

function notConfiguredError(): never {
  throw new Error(
    'Firebase no está configurado. Crea un archivo .env.local con tus credenciales.',
  )
}

const USERS_COLLECTION = 'users'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────────

  const currentUser = ref<AppUser | null>(null)
  const guestPreferences = ref<UserPreferences>(JSON.parse(localStorage.getItem('guest_prefs') || '{}'))
  const isLoading = ref(false)
  const isInitialized = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ─────────────────────────────────────────────────────────────────

  const isAuthenticated = computed(() => currentUser.value !== null)

  const favoriteClubId = computed(
    () => currentUser.value?.preferences.favoriteClubId ?? null,
  )

  const userDisplayName = computed(
    () =>
      currentUser.value?.displayName ||
      currentUser.value?.email?.split('@')[0] ||
      'Invitado',
  )

  // ── Firestore helpers ────────────────────────────────────────────────────────

  async function upsertUserDoc(
    firebaseUser: FirebaseUser,
    extraPrefs: Partial<UserPreferences> = {},
  ): Promise<UserPreferences> {
    if (!db) notConfiguredError()
    const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
    const snap = await getDoc(userRef)

    if (!snap.exists()) {
      const defaultPrefs: UserPreferences = {
        theme: 'dark',
        language: 'es',
        followedLeagues: [],
        ...extraPrefs,
      }
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        preferences: defaultPrefs,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      })
      return defaultPrefs
    } else {
      await updateDoc(userRef, { lastLoginAt: serverTimestamp() })
      const data = snap.data()
      return (data.preferences as UserPreferences) ?? {}
    }
  }

  async function loadPreferences(): Promise<UserPreferences | null> {
    if (!currentUser.value || !db) return null
    const userRef = doc(db, USERS_COLLECTION, currentUser.value.uid)
    const snap = await getDoc(userRef)
    if (snap.exists()) return (snap.data().preferences as UserPreferences) ?? {}
    return null
  }

  async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    // Save to guest preferences (LocalStorage) first
    guestPreferences.value = { ...guestPreferences.value, ...prefs }
    localStorage.setItem('guest_prefs', JSON.stringify(guestPreferences.value))

    if (!currentUser.value) return // If not logged in, we are done

    if (!db) notConfiguredError()

    try {
      const userRef = doc(db, USERS_COLLECTION, currentUser.value.uid)
      const updates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(prefs)) {
        updates[`preferences.${key}`] = value
      }

      // Update local auth state
      currentUser.value = {
        ...currentUser.value,
        preferences: { ...currentUser.value.preferences, ...prefs },
      }

      await updateDoc(userRef, updates)
    } catch (e) {
      console.error('Error saving preferences to Firestore:', e)
      throw e
    }
  }

  async function setFavoriteClub(
    clubId: number | string,
    clubName: string,
    clubLogo: string,
  ): Promise<void> {
    const normalizedId = typeof clubId === 'string' && !isNaN(Number(clubId)) ? Number(clubId) : clubId
    await savePreferences({
      favoriteClubId: normalizedId as number,
      favoriteClubName: clubName,
      favoriteClubLogo: clubLogo
    })
  }

  // ── Observador de autenticación ───────────────────────────────────────────

  function initAuthListener(): void {
    // Si Firebase no está configurado, marcar como inicializado inmediatamente
    if (!isFirebaseConfigured || !auth) {
      isInitialized.value = true
      return
    }

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const preferences = await loadPreferencesForUser(firebaseUser.uid)

          // Sincronización: Si hay algo en guest_prefs pero no en Firestore, subirlo
          if (Object.keys(guestPreferences.value).length > 0 && Object.keys(preferences).length === 0) {
            await savePreferences(guestPreferences.value)
          }

          currentUser.value = mapFirebaseUser(firebaseUser, { ...guestPreferences.value, ...preferences })
        } catch {
          currentUser.value = mapFirebaseUser(firebaseUser, guestPreferences.value)
        }
      } else {
        currentUser.value = null
      }
      isInitialized.value = true
    })
  }

  async function loadPreferencesForUser(uid: string): Promise<UserPreferences> {
    if (!db) return {}
    const userRef = doc(db, USERS_COLLECTION, uid)
    const snap = await getDoc(userRef)
    return snap.exists() ? ((snap.data().preferences as UserPreferences) ?? {}) : {}
  }

  // ── Acciones de autenticación ─────────────────────────────────────────────

  async function loginWithEmail(email: string, password: string): Promise<AppUser> {
    if (!auth) notConfiguredError()
    isLoading.value = true
    error.value = null
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      // Optimistic update
      currentUser.value = mapFirebaseUser(user)

      // Sync in background
      upsertUserDoc(user).then(preferences => {
        if (currentUser.value && currentUser.value.uid === user.uid) {
          currentUser.value.preferences = preferences
        }
      })

      return currentUser.value
    } catch (e) {
      error.value = getFirebaseErrorMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function registerWithEmail(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AppUser> {
    if (!auth) notConfiguredError()
    isLoading.value = true
    error.value = null
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName })
      const preferences = await upsertUserDoc(user)
      currentUser.value = mapFirebaseUser(user, preferences)
      return currentUser.value
    } catch (e) {
      error.value = getFirebaseErrorMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loginWithGoogle(): Promise<AppUser> {
    if (!auth) notConfiguredError()
    isLoading.value = true
    error.value = null
    try {
      const { user } = await signInWithPopup(auth, googleProvider)

      // Optimistic update: Set user immediately
      currentUser.value = mapFirebaseUser(user)

      // Background sync: Don't await this
      upsertUserDoc(user).then(preferences => {
        if (currentUser.value && currentUser.value.uid === user.uid) {
          currentUser.value.preferences = preferences
        }
      })

      return currentUser.value
    } catch (e) {
      error.value = getFirebaseErrorMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loginWithFacebook(): Promise<AppUser> {
    if (!auth) notConfiguredError()
    isLoading.value = true
    error.value = null
    try {
      const { user } = await signInWithPopup(auth, facebookProvider)
      const preferences = await upsertUserDoc(user)
      currentUser.value = mapFirebaseUser(user, preferences)
      return currentUser.value
    } catch (e) {
      error.value = getFirebaseErrorMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function resetPassword(email: string): Promise<void> {
    if (!auth) notConfiguredError()
    isLoading.value = true
    error.value = null
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (e) {
      error.value = getFirebaseErrorMessage(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    if (auth) await signOut(auth)
    currentUser.value = null
  }

  async function updateUserProfile(displayName: string, photoURL?: string): Promise<void> {
    if (!auth || !auth.currentUser) throw new Error('No hay usuario autenticado')
    isLoading.value = true
    try {
      await updateProfile(auth.currentUser, { displayName, photoURL })
      // Update Firestore doc too
      const userRef = doc(db!, USERS_COLLECTION, auth.currentUser.uid)
      await updateDoc(userRef, { displayName, photoURL })

      if (currentUser.value) {
        currentUser.value.displayName = displayName
        currentUser.value.photoURL = photoURL || currentUser.value.photoURL
      }
    } finally {
      isLoading.value = false
    }
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  function getFirebaseErrorMessage(e: unknown): string {
    if (e && typeof e === 'object' && 'code' in e) {
      const code = (e as { code: string }).code
      const messages: Record<string, string> = {
        'auth/user-not-found': 'No existe una cuenta con ese email.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Este email ya está registrado.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'El formato del email no es válido.',
        'auth/popup-closed-by-user': 'Cerraste la ventana de login.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
        'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
      }
      return messages[code] ?? `Error de autenticación (${code})`
    }
    return 'Error desconocido durante la autenticación'
  }

  return {
    currentUser,
    isLoading,
    isInitialized,
    error,
    isFirebaseConfigured,
    isAuthenticated,
    favoriteClubId,
    userDisplayName,
    initAuthListener,
    loadPreferences,
    savePreferences,
    setFavoriteClub,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    loginWithFacebook,
    resetPassword,
    logout,
    updateUserProfile,
    guestPreferences,
  }
})
