import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// 构建时把 assets/ 下全部 PNG 转 base64 注入 window.__EMBEDDED_ASSETS，
// 使单文件 game.html 脱离目录结构也自带素材；开发模式不生效（走文件探测）。
function inlineAssets() {
  return {
    name: 'inline-assets',
    apply: 'build',
    transformIndexHtml(html) {
      const root = 'assets';
      const map = {};
      const walk = (dir) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (/\.png$/i.test(f)) {
            map[relative(root, p).split('\\').join('/')] =
              'data:image/png;base64,' + readFileSync(p).toString('base64');
          }
        }
      };
      try { walk(root); } catch (e) { /* 无素材目录也照常构建 */ }
      return {
        html,
        tags: [{
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.__EMBEDDED_ASSETS=${JSON.stringify(map)};`,
        }],
      };
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: 'assets', // assets/ 仍原样拷贝进产物根目录（多页部署时可被覆盖更新）
  plugins: [inlineAssets(), viteSingleFile()],
  build: { target: 'es2020' },
});
