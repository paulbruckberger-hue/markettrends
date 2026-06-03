/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0A0F1E', 900: '#0F172A', 850: '#111827', 800: '#1E293B', 700: '#334155' },
        accent: { 400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
