import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#EEF0EE",
          surface: "#FAFBFA",
          primary: "#F6F8F6",
          accent: "#71BC78",
          border: "#D8DED8",
          muted: "#8B9790",
          text: "#101217",
          "text-muted": "#66736C",
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
