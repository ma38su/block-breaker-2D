import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA プラグイン: Service Worker とウェブアプリマニフェストを自動生成する
    VitePWA({
      registerType: 'autoUpdate',
      // Service Worker の precache 対象
      includeAssets: ['icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Block Breaker | ブロック崩し',
        short_name: 'ブロック崩し',
        description: 'レトロなネオン風ブロック崩しゲーム',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      // 開発中も Service Worker を有効にして動作確認できるようにする
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
