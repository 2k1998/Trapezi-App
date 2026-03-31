import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FAFAF7',
          100: '#F2F1EB',
          200: '#E3E1D9',
          300: '#C8C5BB',
          400: '#9D9A8E',
          500: '#6B6860',
          600: '#3D3C37',
          700: '#2A2925',
          800: '#1A1916',
          900: '#0F0E0D',
        },
        accent: {
          400: '#D4A853',
          500: '#B8892E',
          600: '#8C6420',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-playfair)', 'Playfair Display', ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        'premium': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        'card':    '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'elevated':'0 4px 16px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.06)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in':    'fadeIn 320ms ease-out',
        'fade-up':    'fadeUp 400ms ease-out',
        'scale-in':   'scaleIn 280ms ease-out',
        'slide-right':'slideRight 350ms ease-out',
        'shimmer':    'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
