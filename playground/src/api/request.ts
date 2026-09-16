import { useAppConfig } from '@vben/hooks';
import {
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'antdv-next';

import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
export const requestClient = new RequestClient({
  baseURL: apiURL,
  responseReturn: 'data',
});
export const baseRequestClient = requestClient;
const publicPaths = new Set([
  '/auth/captcha',
  '/auth/captcha/verify',
  '/auth/login',
  '/auth/public-key',
]);
requestClient.addRequestInterceptor({
  fulfilled(config) {
    // 随机客户端标识只用于操作日志关联，不包含账号、Token，也不参与鉴权。
    try {
      let clientId = localStorage.getItem('xk-operation-client-id');
      if (!clientId || !/^[a-f0-9-]{36}$/i.test(clientId)) {
        clientId = crypto.randomUUID();
        localStorage.setItem('xk-operation-client-id', clientId);
      }
      config.headers['X-Client-Id'] = clientId;
    } catch {
      /* 浏览器禁用存储时保持未知，不影响正常请求。 */
    }
    const token = useAccessStore().accessToken;
    if (token && !publicPaths.has(config.url ?? ''))
      config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
});
requestClient.addResponseInterceptor({
  fulfilled(response) {
    // 仅当前会话的响应可以更新寿命；页面静默不发送保活请求。
    const token = useAccessStore().accessToken;
    const sent = response.config.headers.Authorization;
    if (sent && sent !== `Bearer ${token}`)
      throw new Error('会话已变更，请重新操作');
    const ttl = Number(response.headers['x-session-ttl']);
    if (
      token &&
      response.config.headers.Authorization === `Bearer ${token}` &&
      ttl > 0
    ) {
      useAuthStore().setExpiresAt(Date.now() + ttl);
    }
    return response;
  },
});
requestClient.addResponseInterceptor(
  defaultResponseInterceptor({
    codeField: 'code',
    dataField: 'data',
    successCode: 'SUCCESS',
  }),
);
requestClient.addResponseInterceptor({
  rejected: async (error) => {
    const token = useAccessStore().accessToken;
    if (
      error.response?.status === 401 &&
      token &&
      error.config?.headers?.Authorization === `Bearer ${token}`
    ) {
      await useAuthStore().clearSession();
    }
    throw error;
  },
});
requestClient.addResponseInterceptor(
  errorMessageResponseInterceptor((msg, error) => {
    message.error(error.response?.data?.message || msg);
  }),
);
export interface PageFetchParams {
  [key: string]: unknown;
  pageNo?: number;
  pageSize?: number;
}
