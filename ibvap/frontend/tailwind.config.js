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
        background: '#070a12',
        surface: {
          DEFAULT: '#0d1322',
          subtle: '#11182c',
          card: '#141c33',
          elevated: '#1a2440',
          border: '#1f2c4d',
          'border-light': '#2d3e6b',
        },
        tactical: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
          crimson: '#ef4444',
          slate: '#64748b',
          muted: '#94a3b8',
        },
        surveillance: {
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'tactical': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(31, 44, 77, 0.6)',
        'tactical-glow': '0 0 15px -3px rgba(59, 130, 246, 0.25)',
        'alert-glow': '0 0 20px -2px rgba(239, 68, 68, 0.3)',
        'emerald-glow': '0 0 15px -3px rgba(16, 185, 129, 0.25)',
      },
    },
  },
  plugins: [],
}
