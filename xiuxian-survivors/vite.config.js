import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  publicDir: 'assets', // assets/ 原样拷贝进产物根目录（不内联）
  plugins: [viteSingleFile()],
  build: { target: 'es2020' },
});
