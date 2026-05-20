import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#F5F5F8",
          surface: "#FFFFFF",
          primary: "#FFFFFF",
          accent: "#34A853",
          border: "#E7E7EC",
          muted: "#95A0AF",
          text: "#101217",
          "text-muted": "#6D7683",
        },
      },
      fontFamily: {
        mono: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
