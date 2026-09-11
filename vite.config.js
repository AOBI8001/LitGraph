import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { localService } from './scripts/local-service.js';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ command, mode }) => ({
  worker: { format: 'es' },
  server: { watch: { ignored: ['**/output/**', '**/release/**', '**/data/**', '**/projects/**'] } },
  plugins: [
    {
      name: 'litgraph-sample',
      resolveId(id) { if (id === 'virtual:litgraph-sample') return '\0litgraph-sample'; },
      load(id) {
        if (id !== '\0litgraph-sample') return;
        let catalog = null;
        try { catalog = JSON.parse(readFileSync(new URL('./public/sample-fulltext/index.json', import.meta.url), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        return `import sample from "/src/public-sample.js"; import {withSampleCorpus} from "/src/sample-corpus.js"; export default withSampleCorpus(sample, ${JSON.stringify(catalog)});`;
      }
    },
    { name: 'litgraph-local-service', configureServer(server) { server.middlewares.use(localService(root)); }, configurePreviewServer(server) { server.middlewares.use(localService(root)); } }
  ]
}));
