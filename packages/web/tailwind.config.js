/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep navy foundation
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0a1929',
        },
        // Teal accent for vitals and positive states
        teal: {
          50: '#effcf9',
          100: '#c6f7e9',
          200: '#8eedc7',
          300: '#5fe3b0',
          400: '#44d9a6',
          500: '#27ab83',
          600: '#199473',
          700: '#147d64',
          800: '#0c6b58',
          900: '#014d40',
        },
        // Warm accent for alerts
        coral: {
          50: '#fff5f5',
          100: '#fed7d7',
          200: '#feb2b2',
          300: '#fc8181',
          400: '#f56565',
          500: '#e53e3e',
          600: '#c53030',
          700: '#9b2c2c',
          800: '#822727',
          900: '#63171b',
        },
        // Clinical white backgrounds
        clinical: {
          50: '#fafbfc',
          100: '#f4f6f8',
          200: '#ebeef2',
        },
      },
      fontFamily: {
        // DM Sans for headings - geometric, professional
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        // Source Sans 3 for body - clear, clinical readability
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        // Mono for MRNs and clinical values
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        'clinical': '0 1px 3px rgba(16, 42, 67, 0.08), 0 1px 2px rgba(16, 42, 67, 0.06)',
        'clinical-md': '0 4px 6px -1px rgba(16, 42, 67, 0.08), 0 2px 4px -1px rgba(16, 42, 67, 0.04)',
        'clinical-lg': '0 10px 15px -3px rgba(16, 42, 67, 0.08), 0 4px 6px -2px rgba(16, 42, 67, 0.04)',
        'clinical-xl': '0 20px 25px -5px rgba(16, 42, 67, 0.1), 0 10px 10px -5px rgba(16, 42, 67, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
