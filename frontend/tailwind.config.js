/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#85acff',
          400: '#5b8bfa',
          500: '#3b6bf0',
          600: '#2f56d6',
          700: '#2643ab',
          800: '#1f3685',
          900: '#1a2c6b',
        },
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};
