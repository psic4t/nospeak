/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
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
          700: '#6c6f85', // Subtext0
          800: '#5c5f77', // Subtext1
          900: '#4c4f69', // Text
        },
        // Lavender Accent (Blue Override)
        blue: {
          50: '#eaedff', // Very light lavender
          100: '#dce1ff',
          200: '#c2caff',
          300: '#9eaaff',
          400: '#b4befe', // Mocha Lavender (Light)
          500: '#7287fd', // Latte Lavender (Main Button)
          600: '#5b6ee1', // Darker Lavender (Hover/Gradient)
          700: '#4a5bd2',
          800: '#3d4bb0',
          900: '#35418b',
          950: '#232955',
        }
      }
    },
  },
  plugins: [],
}
