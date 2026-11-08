import type { Config } from 'tailwindcss';
import scrollbar from 'tailwind-scrollbar';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  plugins: [
    scrollbar({ nocompatible: true }),
    // short windows on a wide screen, as variants (a raw screen would drop every max-* variant): a laptop at 125% scale
    // (1920x1080 leaves about 1536x730, 1600x900 about 1280x580); tiny: 1366x768 at 125% leaves about 1090x480. They sort
    // BEFORE md: and lg: rules: to override a property an md:/lg: class sets, stack them (lg:short:max-h-[...] wins)
    plugin(({ addVariant }) => {
      addVariant('short', '@media (min-width: 768px) and (max-height: 780px)');
      addVariant('tiny', '@media (min-width: 768px) and (max-height: 560px)');
    }),
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      /* Colors */
      colors: {
        'primary': 'rgba(var(--primary), <alpha-value>)',
        'secondary': 'rgba(var(--secondary), <alpha-value>)',
        'tertiary': 'rgba(var(--tertiary), <alpha-value>)',
        'active': 'rgba(var(--active), <alpha-value>)',
        'success': 'rgba(var(--success), <alpha-value>)',
        'fail': 'rgba(var(--fail), <alpha-value>)',
        'muted': 'rgba(var(--muted), <alpha-value>)',
        'faint': 'rgba(var(--faint), <alpha-value>)',
        'warn': 'rgba(var(--warn), <alpha-value>)',
        'line': 'var(--line)',
        'line-strong': 'var(--line-strong)',
        'inset': 'rgb(255 255 255 / 0.05)',
        'box-border': 'var(--box-border)',
        'card-background': 'var(--card-background)',
      },
      /* Background */
      backgroundImage: {
        'input-fields': 'var(--input-fields)',
        'primary-buttons': 'var(--primary-buttons)',
        'primary-buttons-hover': 'var(--primary-buttons-hover)',
        'highlighed-components': 'var(--highlighed-components)',
        'background-dark': 'var(--background-dark)',
        'shapes-background': 'var(--shapes-background)',
        'card-background': 'var(--card-background)',
        'box-background-secondary': 'var(--box-background-secondary)',
        'box-border-gradient': 'var(--box-border-gradient)',
        'box-background': 'var(--box-background)',
        'highlighted-card': 'var(--highlighted-card)',
        'input-fields-hover': 'var(--input-fields-hover)',
      },
      /* Screen Sizes */
      screens: {
        xs: '480px',
      },

      /* Keyframes */
      keyframes: {
        // Panel
        'slideInFromRight': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slideInFromLeft': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slideInFromTop': {
          '0%': { transform: 'translateY(-10%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in': {
          '0%': {
            opacity: '0',
            transform: 'translateX(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        'slideInFromTopWithHeight': {
          '0%': {
            transform: 'translateY(-10%)',
            opacity: '0',
            maxHeight: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
            maxHeight: '700px',
          },
        },
        // both ends written out: from an implicit start Chrome cannot run it on the GPU (292 ms of work in 3 s against 12)
        spin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'border-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fadeIn': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },

        // Landing
        'scroll-button-effect': {
          '0%': { opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'border-rotate': {
          '0%': { transform: 'rotate(0)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'border-move-rotate': {
          '0%': { 'offset-distance': '0%' },
          '100%': { 'offset-distance': '100%' },
        },
        'text-stroke': {
          '0%': {
            fill: 'rgba(72, 138, 20, 0)',
            stroke: 'rgba(54, 95, 160, 1)',
            strokeDashoffset: '25%',
            strokeDasharray: '0 50%',
            strokeWidth: '2',
          },
          '70%': {
            fill: 'rgba(72, 138, 20, 0)',
            stroke: 'rgba(54, 95, 160, 1)',
          },
          '80%': {
            fill: 'rgba(72, 138, 20, 0)',
            stroke: 'rgba(54, 95, 160, 1)',
            strokeWidth: '3',
          },
          '100%': {
            fill: '#1C68F8',
            stroke: 'rgba(54, 95, 160, 0)',
            strokeDashoffset: '-25%',
            strokeDasharray: '50% 0',
            strokeWidth: '3',
          },
        },
        'scroll': {
          '100%': {
            transform: 'translate(calc(-50% - 2rem))',
          },
        },
      },

      /* Animation */
      animation: {
        // Panel
        'slide-in-from-right': 'slideInFromRight 0.35s ease-in-out',
        'slide-in-from-left': 'slideInFromLeft 0.35s ease-in-out',
        'slide-in': 'slide-in 0.2s ease-out 0.07s forwards',
        'slide-in-from-top': 'slideInFromTop 0.15s ease-out',
        'slide-in-with-height': 'slideInFromTopWithHeight 0.2s ease-out forwards',
        'border-spin': 'border-spin 2s linear infinite',
        'fade': 'fadeIn .35s ease-in-out',

        // Landing
        'border-rotate': 'border-rotate 5s linear forwards infinite',
        'infinite-scroll': 'scroll 20s linear infinite',
        'text-stroke': 'text-stroke 5s both alternate',
        'border-move-rotate': 'border-move-rotate 12s linear infinite',
        'scroll-button-effect-animate': 'scroll-button-effect 2.5s infinite',
      },
    },
  },
};
export default config;
