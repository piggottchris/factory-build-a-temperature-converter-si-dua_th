import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./node_modules/@copilotkit/react-ui/**/*.{js,mjs}",
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
