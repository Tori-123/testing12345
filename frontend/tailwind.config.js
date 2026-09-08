/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--bg)",
        ink: "var(--fg)",
        muted: "var(--muted)",
        surface: "var(--surface)",
        line: "var(--border)",
        wood: "var(--border-strong)",
      },
    },
  },
  plugins: [],
};
