/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      opacity: {
        80: '0.80',
      },
      colors: {
        // Catppuccin Mocha (Dark Mode) mapping for 'slate'
        slate: {
          50: '#f5f5f5',
          100: '#cdd6f4', // Text
          200: '#bac2de', // Subtext1
          300: '#a6adc8', // Subtext0
          400: '#9399b2', // Overlay2
          500: '#585b70', // Surface2
          600: '#45475a', // Surface1
          700: '#313244', // Surface0 (Inputs)
          800: '#1e1e2e', // Base (Cards)
          900: '#181825', // Mantle (Sidebar)
          950: '#11111b', // Crust (Main BG)
        },
        // Catppuccin Latte (Light Mode) mapping for 'gray'
        gray: {
          50: '#eff1f5', // Base
          100: '#e6e9ef', // Mantle
          200: '#ccd0da', // Surface0
          300: '#bcc0cc', // Surface1
          400: '#acb0be', // Surface2
          500: '#9ca0b0', // Overlay0
          600: '#8c8fa1', // Overlay1
          700: '#374151', // Subtext0 -> darker
          800: '#1f2937', // Subtext1 -> darker
          900: '#111827', // Text -> almost black
        },
        // Catppuccin blue override for Tailwind 'blue' using active theme
        blue: {
          50: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          100: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          200: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          300: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          400: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          900: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
          950: 'rgb(var(--color-blue-rgb) / <alpha-value>)',
        },
        // Brand color Lavender
        lavender: {
          50: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          100: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          200: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          300: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          400: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          900: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
          950: 'rgb(var(--color-lavender-rgb) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}
