/**
 * @file firebase.ts
 * Inicialización de Firebase App, Auth y Firestore.
 *
 * Variables de entorno requeridas en .env.local:
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *
 * Mientras no estén configuradas, Firebase no se inicializa y la app
 * funciona en modo sin autenticación (útil para desarrollo).
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined

/**
 * Detecta si las variables de entorno de Firebase están configuradas.
 * Los valores placeholder (YOUR_*) o vacíos se consideran no configurados.
 */
export const isFirebaseConfigured =
  !!apiKey &&
  !apiKey.startsWith('YOUR_') &&
  apiKey !== 'undefined'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
} else {
  console.warn(
    '[Soccer Engine] Firebase no está configurado.\n' +
    'Crea src/.env.local con tus credenciales de Firebase.\n' +
    'La autenticación estará deshabilitada hasta entonces.',
  )
}

export { app, auth, db }

// Proveedores OAuth (siempre disponibles, se usan solo si Firebase está activo)
export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('profile')
googleProvider.addScope('email')

export const facebookProvider = new FacebookAuthProvider()
facebookProvider.addScope('email')
