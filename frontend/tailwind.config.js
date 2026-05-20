/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F19',
          card: 'rgba(17, 24, 39, 0.7)',
          border: 'rgba(255, 255, 255, 0.08)',
          glow: '#00FF66',
        },
        brand: {
          primary: '#00FF66', // Neon Green
          secondary: '#00E5FF', // Neon Cyan
          accent: '#FFB000', // Cyber Amber
          success: '#00FF66',
          warning: '#FFB000',
          danger: '#FF3B30',
        },
        cyber: {
          green: '#00FF66',
          cyan: '#00E5FF',
          amber: '#FFB000',
          red: '#FF3B30',
          black: '#121212',
          slate: '#1E293B',
          darkBg: '#0B0F19',
          lightBg: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Courier New', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'glass-glow': 'linear-gradient(135deg, rgba(0, 255, 102, 0.1) 0%, rgba(0, 229, 255, 0.05) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.1)',
        'glow-green': '0 0 15px rgba(0, 255, 102, 0.3)',
        'glow-blue': '0 0 15px rgba(0, 229, 255, 0.3)',
        'glow-amber': '0 0 15px rgba(255, 176, 0, 0.3)',
        'cyber-hover': '0 0 12px rgba(0, 229, 255, 0.15)',
      },
      backdropFilter: {
        'glass': 'blur(12px)',
      }
    },
  },
  plugins: [],
}
