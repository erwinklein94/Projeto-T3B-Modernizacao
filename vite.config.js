import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "private-local-preview",
      configureServer(server) {
        server.middlewares.use(
          "/Projeto-T3B-Modernizacao/__preview-data",
          (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(fs.readFileSync(".private/history.json", "utf8"));
          },
        );
      },
    },
  ],
  base: "/Projeto-T3B-Modernizacao/",
});
