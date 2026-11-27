/** @type {import('tailwindcss').Config} */
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: rgb('page'),
        surface: rgb('surface'),
        'surface-2': rgb('surface-2'),
        line: rgb('line'),
        ink: rgb('ink'),
        'ink-2': rgb('ink-2'),
        muted: rgb('muted'),
        accent: rgb('accent'),
        'accent-ink': rgb('accent-ink'),
        'on-accent': rgb('on-accent'),
        pos: rgb('pos'),
        neg: rgb('neg'),
        warn: rgb('warn'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', '"Segoe UI"', 'Tahoma', 'sans-serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'page-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'modal-in': { from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '70%': { opacity: '1', transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'flash-up': { from: { backgroundColor: 'rgb(var(--pos) / 0.22)' }, to: { backgroundColor: 'transparent' } },
        'flash-down': { from: { backgroundColor: 'rgb(var(--neg) / 0.22)' }, to: { backgroundColor: 'transparent' } },
        breathe: { '0%, 100%': { opacity: '0.55', transform: 'scale(0.96)' }, '50%': { opacity: '1', transform: 'scale(1)' } },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%) scaleX(0.4)' },
          '50%': { transform: 'translateX(30%) scaleX(0.6)' },
          '100%': { transform: 'translateX(120%) scaleX(0.4)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'page-in': 'page-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'modal-in': 'modal-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'toast-in': 'toast-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'pop-in': 'pop-in 280ms ease-out',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'flash-up': 'flash-up 1.4s ease-out',
        'flash-down': 'flash-down 1.4s ease-out',
        breathe: 'breathe 1.8s ease-in-out infinite',
        'progress-indeterminate': 'progress-indeterminate 1.3s ease-in-out infinite',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        pop: '0 12px 32px rgb(0 0 0 / 0.18)',
      },
    },
  },
  plugins: [],
};
