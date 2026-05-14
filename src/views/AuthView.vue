<template>
  <div class="view auth-view">
    <div class="auth-container">
      <div class="auth-card card">
        <header class="auth-header">
          <h1 class="auth-title">{{ isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta' }}</h1>
          <p class="auth-subtitle">
            {{ isLogin ? 'Accede a tu cuenta para continuar.' : 'Únete para personalizar tu experiencia.' }}
          </p>
        </header>

        <!-- Social Auth -->
        <div class="auth-social">
          <button
            class="btn btn-secondary btn-social"
            @click="handleSocialAuth('google')"
            :disabled="authStore.isLoading"
          >
            <span class="social-icon">G</span> Google
          </button>
          <button
            class="btn btn-secondary btn-social"
            @click="handleSocialAuth('facebook')"
            :disabled="authStore.isLoading"
          >
            <span class="social-icon">f</span> Facebook
          </button>
        </div>

        <div class="auth-divider">
          <span>o continúa con email</span>
        </div>

        <!-- Error Message -->
        <div v-if="authStore.error" class="auth-error">
          {{ authStore.error }}
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-group" v-if="!isLogin">
            <label for="displayName">Nombre</label>
            <input
              id="displayName"
              type="text"
              v-model="displayName"
              placeholder="Tu nombre completo"
              required
              :disabled="authStore.isLoading"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              v-model="email"
              placeholder="tu@email.com"
              required
              :disabled="authStore.isLoading"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <div class="form-group-header">
              <label for="password">Contraseña</label>
              <a v-if="isLogin" href="#" @click.prevent="handleResetPassword" class="auth-link auth-link--small">¿Olvidaste tu contraseña?</a>
            </div>
            <input
              id="password"
              type="password"
              v-model="password"
              placeholder="••••••••"
              required
              minlength="6"
              :disabled="authStore.isLoading"
              class="form-input"
            />
          </div>

          <button type="submit" class="btn btn-primary auth-submit" :disabled="authStore.isLoading">
            {{ authStore.isLoading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse') }}
          </button>
        </form>

        <footer class="auth-footer">
          <p>
            {{ isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?' }}
            <a href="#" @click.prevent="toggleMode" class="auth-link">
              {{ isLogin ? 'Regístrate aquí' : 'Inicia sesión' }}
            </a>
          </p>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// State
const isLogin = ref(true)
const email = ref('')
const password = ref('')
const displayName = ref('')

// Acciones
function toggleMode() {
  isLogin.value = !isLogin.value
  authStore.error = null // Limpiar errores al cambiar de modo
}

async function handleSubmit() {
  try {
    if (isLogin.value) {
      await authStore.loginWithEmail(email.value, password.value)
    } else {
      await authStore.registerWithEmail(email.value, password.value, displayName.value)
    }
    handleSuccess()
  } catch (error) {
    // El error ya es manejado y asignado a authStore.error por el store
  }
}

async function handleSocialAuth(provider: 'google' | 'facebook') {
  try {
    if (provider === 'google') await authStore.loginWithGoogle()
    if (provider === 'facebook') await authStore.loginWithFacebook()
    handleSuccess()
  } catch (error) {
    // El error ya es manejado
  }
}

async function handleResetPassword() {
  if (!email.value) {
    authStore.error = 'Por favor, introduce tu email para recuperar la contraseña.'
    return
  }
  try {
    await authStore.resetPassword(email.value)
    alert('Te hemos enviado un correo para restablecer tu contraseña.')
  } catch (error) {
    // El error ya es manejado
  }
}

function handleSuccess() {
  // Redirigir a la URL intentada previa o a la home
  const redirect = route.query.redirect as string || '/'
  router.push(redirect)
}
</script>

<style scoped>
.auth-view {
  min-height: calc(100vh - 140px); /* Ajuste según nav/footer */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.1), transparent 40%),
              radial-gradient(circle at bottom left, rgba(var(--color-blue-rgb), 0.1), transparent 40%);
}

.auth-container {
  width: 100%;
  max-width: 440px;
}

.auth-card {
  padding: var(--space-8);
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  /* Glassmorphism enhancement over base card */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.auth-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.auth-title {
  font-size: 2rem;
  font-family: var(--font-display);
  margin-bottom: var(--space-2);
  color: var(--color-text-primary);
}

.auth-subtitle {
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

/* Social Buttons */
.auth-social {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.btn-social {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--color-bg-tertiary);
  border-color: transparent;
}

.btn-social:hover {
  background: var(--color-bg-overlay);
  border-color: var(--color-border);
}

.social-icon {
  font-weight: 800;
  font-size: 1.1em;
  font-family: var(--font-display);
}

/* Divider */
.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin-bottom: var(--space-6);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-border);
}

.auth-divider span {
  padding: 0 var(--space-3);
}

/* Forms */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 1rem;
  transition: all var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.15);
  background: var(--color-bg-elevated);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.auth-submit {
  margin-top: var(--space-2);
  padding: var(--space-3);
  font-size: 1rem;
}

/* Error */
.auth-error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-red);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid rgba(239, 68, 68, 0.2);
  margin-bottom: var(--space-5);
  font-size: 0.9rem;
  text-align: center;
}

/* Footer / Links */
.auth-footer {
  margin-top: var(--space-6);
  text-align: center;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.auth-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 600;
  transition: color var(--transition-fast);
}

.auth-link:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}

.auth-link--small {
  font-size: 0.8rem;
  font-weight: 500;
}
</style>
