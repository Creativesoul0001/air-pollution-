import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Noto Sans Devanagari", "sans-serif"],
      },
      colors: {
        aqi: {
          good: "#10b981",
          moderate: "#eab308",
          poor: "#f97316",
          veryPoor: "#ef4444",
          severe: "#7f1d1d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
