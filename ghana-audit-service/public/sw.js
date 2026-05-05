// Placeholder service worker for development
// This file is replaced by @vite-pwa/nuxt in production
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
