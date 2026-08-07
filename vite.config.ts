import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            // ponytail: injectManifest + no __WB_MANIFEST — generateSW hangs on Vite 8/Rolldown
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'prompt',
            injectManifest: {
                injectionPoint: undefined,
            },
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'BOhub — by BOcode',
                short_name: 'BOhub',
                description: 'Hub interno de BOcode',
                lang: 'es',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                theme_color: '#1a1d1e',
                background_color: '#1a1d1e',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-512x512-maskable.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(rootDir, './src'),
        },
    },
    server: {
        port: 5173,
    },
})
