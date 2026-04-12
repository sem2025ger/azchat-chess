/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          dark: '#121212',
          surface: '#1E1E1E',
          surfaceHover: '#2A2A2A',
          boardLight: '#E8EDF9',
          boardDark: '#B7C0D8',
          accent: '#c0a080',
          active: '#00ced1',
          gold: '#DFB062'
        }
      }
    },
  },
  plugins: [],
}
