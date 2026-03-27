/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          card: '#161b22',
          raised: '#1c2233',
          border: '#30363d',
        },
        brand: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      }
    }
  },
  plugins: []
}
