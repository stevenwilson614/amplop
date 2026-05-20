import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0D1F1A",
          surface: "#142E24",
          primary: "#1A4D3A",
          accent: "#2D8659",
          border: "#1E4534",
          muted: "#4A7A62",
          text: "#E8F5EE",
          "text-muted": "#8DB8A0",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
