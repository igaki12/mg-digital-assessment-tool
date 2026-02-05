import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/MG-digital-assessment-tool/",
  plugins: [react()],
  build: {
    outDir: "docs"
  }
});
