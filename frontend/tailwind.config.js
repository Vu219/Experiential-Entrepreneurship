/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Dark mode = class "dark" trên <html> (store/colorMode.ts); màu chính đi qua var(--c-*).
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
