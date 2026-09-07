import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { localService } from './scripts/local-service.js';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ command, mode }) => ({
  plugins: [
    {
      name: 'litgraph-sample',
      resolveId(id) { if (id === 'virtual:litgraph-sample') return '\0litgraph-sample'; },
      load(id) {
        if (id !== '\0litgraph-sample') return;
        return 'export { default } from "/src/public-sample.js";';
      }
    },
    { name: 'litgraph-local-service', configureServer(server) { server.middlewares.use(localService(root)); }, configurePreviewServer(server) { server.middlewares.use(localService(root)); } }
  ]
}));
