import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
