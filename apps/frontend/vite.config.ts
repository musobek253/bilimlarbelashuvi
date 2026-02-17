import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        legacy({
            targets: ['defaults', 'not IE 11']
        })
    ],
    server: {
        host: true,
        port: 5173
    },
    build: {
        target: 'es2015'
    }
})

