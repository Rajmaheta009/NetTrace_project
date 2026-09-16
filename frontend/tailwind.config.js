/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          darkest: '#070b13',
          darker: '#0c1322',
          card: '#111b30',
          border: '#1e293b',
          accent: '#06b6d4',
        }
      }
    },
  },
  plugins: [],
}
