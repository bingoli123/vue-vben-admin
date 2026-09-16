import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => ({
  application: {},
  vite: {
    server: {
      proxy: Object.fromEntries(
        ['/api', '/ureport'].map((path) => [
          path,
          {
            target: process.env.XK_BACKEND_URL || 'http://127.0.0.1:8080',
            // 保留浏览器 Host/Origin，使报表 Cookie 的同源校验与开发代理一致。
            changeOrigin: false,
          },
        ]),
      ),
    },
  },
}));
