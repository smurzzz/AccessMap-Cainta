/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B2D45',
        },
        accent: {
          DEFAULT: '#2E8C6A',
        },
        surface: {
          DEFAULT: '#FFFFFF',
        },
      },
      spacing: {
        screen: '16px',
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
      fontFamily: {
        sans: ['Atkinson-Hyperlegible-Next', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
