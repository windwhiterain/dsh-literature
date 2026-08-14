import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  fixedExtension: false,
  deps: {
    neverBundle: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-tools',
      '@deepseek-ai/dsh-fs',
      '@deepseek-ai/schemastery',
    ],
  },
})
