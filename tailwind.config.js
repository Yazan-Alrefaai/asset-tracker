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
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        pop: '0 12px 32px rgb(0 0 0 / 0.18)',
      },
    },
  },
  plugins: [],
};
