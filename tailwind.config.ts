import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f4f7fb",
          100: "#e6edf6",
          200: "#c9d8ea",
          300: "#9db7d7",
          400: "#6b90bd",
          500: "#4872a6",
          600: "#385a8c",
          700: "#2f4a72",
          800: "#243755",
          900: "#16223a",
          950: "#0d1524",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        pop: "0 4px 6px -2px rgba(16,24,40,.05), 0 12px 24px -6px rgba(16,24,40,.12)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
