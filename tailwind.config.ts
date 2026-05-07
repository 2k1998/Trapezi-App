import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0F6FC',
          100: '#DCE9F5',
          200: '#B9D3EB',
          300: '#8BB6DC',
          400: '#5693C8',
          500: '#2C74B5',
          600: '#1D5F9E',
          700: '#184E85',
          800: '#11386A',
          900: '#0A2B54',
          950: '#072E5A',
        },
        accent: {
          50:  '#EEF6FF',
          100: '#D9EBFF',
          200: '#B3D6FF',
          300: '#7DB8F7',
          400: '#4A96EC',
          500: '#1D6FBF',
          600: '#1860A8',
          700: '#134F8A',
          800: '#0F3D6B',
          900: '#0A2D50',
        },
        success: {
          50: '#ECFDF3',
          300: '#86EFAC',
          600: '#16A34A',
          700: '#15803D',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
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
