import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    resolve: {
        // pdf.js ships a separate build for Node; the browser build logs a warning and lacks polyfills there.
        alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.test.{ts,tsx}'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'text', 'html', 'lcov', 'json-summary'],
            include: ['src/**/*.{ts,tsx}'],
            // Only production code counts: tests, test helpers, type-only modules and the entry point are excluded.
            exclude: [
                'src/**/*.test.{ts,tsx}',
                'src/test/**',
                'src/main.tsx',
                'src/vite-env.d.ts',
                'src/services/analysis/worker.ts',
                'src/services/analysis/workerProtocol.ts',
                'src/services/analysis/types.ts',
                'src/services/llm/types.ts',
            ],
            // Enforced in CI; current values are ~97 % lines / ~87 % branches.
            thresholds: {
                lines: 90,
                statements: 90,
                functions: 80,
                branches: 80,
            },
        },
    },
})
