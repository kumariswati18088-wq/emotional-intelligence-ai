/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: "#0b0a14",
          900: "#12111c",
          800: "#1b1a28",
          700: "#262438",
        },
        lavender: {
          300: "#cabdff",
          400: "#b9a6ff",
          500: "#9c85f5",
        },
        coral: {
          400: "#ff9caf",
          500: "#ff8fa3",
        },
        teal: {
          300: "#8ff0e8",
          400: "#6fe7dd",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(185, 166, 255, 0.45)",
      },
    },
  },
  plugins: [],
};
