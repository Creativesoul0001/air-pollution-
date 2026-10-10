import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Noto Sans Devanagari", "sans-serif"],
      },
      colors: {
        dd: {
          bg: "var(--dd-bg)",
          header: "var(--dd-header)",
          card: "var(--dd-card)",
          elev: "var(--dd-elev)",
          border: "var(--dd-border)",
          accent: "var(--dd-accent)",
          accent2: "var(--dd-accent2)",
          purple: "var(--dd-purple)",
          warn: "var(--dd-warn)",
          crit: "var(--dd-crit)",
          text: "var(--dd-text)",
          muted: "var(--dd-muted)",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px var(--dd-border), 0 8px 24px -8px rgba(0, 229, 160, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
