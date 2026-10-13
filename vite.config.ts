import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: './',
    server: { port: 5173 },
    build: {
        target: 'es2022',
        // The largest chunks are lazy: the pdf.js worker and the tokenizer vocabulary (Markdown tab only).
        chunkSizeWarningLimit: 2100,
        rollupOptions: {
            output: {
                // pdf-lib is deliberately not listed: as a manual chunk it would be preloaded,
                // while it is only needed lazily for exporting.
                manualChunks(id) {
                    if (id.includes('node_modules/pdfjs-dist')) {
                        return 'pdfjs-vendor'
                    }
                    if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/zustand')) {
                        return 'react-framework'
                    }
                    if (id.includes('node_modules/lucide-react')) {
                        return 'icons-vendor'
                    }
                    return undefined
                },
            },
        },
    },
})