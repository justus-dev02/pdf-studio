/** @type {import('tailwindcss').Config} */

export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            boxShadow: {
                soft: '0 8px 40px rgba(0,0,0,0.08)'
            },
            borderRadius: {
                xl2: '1rem',
            }
        },
    },
    plugins: [],
}