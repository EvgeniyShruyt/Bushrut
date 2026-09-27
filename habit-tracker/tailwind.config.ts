import type { Config } from 'tailwindcss';

/** Токены дизайн-системы из раздела 7 ТЗ. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0D10', // почти чёрный фон
          soft: '#12161B', // поверхность карточки
          line: '#1E242C', // разделители
          muted: '#7C8794', // второстепенный текст
        },
        racing: {
          DEFAULT: '#E10600', // гоночный красный — основной акцент
          dim: '#8A0B06',
        },
        electric: {
          DEFAULT: '#00D4FF', // электрик-синий — второстепенные элементы
          dim: '#0A6E85',
        },
        signal: {
          go: '#3DDC84', // выполнено
          hold: '#FFB020', // бюджет на грани
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
        glow: '0 0 24px -6px rgba(225,6,0,0.45)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.94)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 160ms ease-out',
        sweep: 'sweep 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
