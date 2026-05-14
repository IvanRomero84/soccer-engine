import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Iniciar el observador de autenticación ANTES de montar la app
// para que el estado esté disponible en los guards de ruta
const authStore = useAuthStore()
authStore.initAuthListener()

app.mount('#app')
