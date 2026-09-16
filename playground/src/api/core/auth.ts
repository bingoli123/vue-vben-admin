import { requestClient } from '#/api/request';

export namespace AuthApi {
  export interface LoginParams {
    username: string;
    password: string;
    captchaToken: string;
  }
  export interface LoginResult {
    token: string;
    expiresIn: number;
  }
  export interface PublicKey {
    keyId: string;
    publicKey: string;
    maxPasswordBytes: number;
  }
}

/** 每次密码提交领取一次性公钥；改密时两份密文共用同一公钥。 */
export async function encryptPasswords(...passwords: string[]) {
  const info = await requestClient.get<AuthApi.PublicKey>('/auth/public-key');
  const der = Uint8Array.from(
    atob(info.publicKey.replaceAll(/-----[^-]+-----|\s/g, '')),
    (c) => c.codePointAt(0) ?? 0,
  );
  const key = await crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  const encrypted = await Promise.all(
    passwords.map(async (value) => {
      const bytes = new TextEncoder().encode(value);
      if (bytes.length > info.maxPasswordBytes)
        throw new Error('密码长度超过服务端限制');
      const result = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        key,
        bytes,
      );
      return btoa(String.fromCodePoint(...new Uint8Array(result)));
    }),
  );
  return { keyId: info.keyId, encrypted };
}
export async function loginApi(data: AuthApi.LoginParams) {
  const { keyId, encrypted } = await encryptPasswords(data.password);
  return requestClient.post<AuthApi.LoginResult>('/auth/login', {
    username: data.username.trim(),
    keyId,
    encryptedPassword: encrypted[0],
    captchaToken: data.captchaToken,
  });
}
export const logoutApi = () => requestClient.post('/auth/logout');
export const getAccessCodesApi = () =>
  requestClient.get<{ administrator: boolean; permissions: string[] }>(
    '/auth/permissions',
  );
export async function changePassword(oldPassword: string, newPassword: string) {
  const { keyId, encrypted } = await encryptPasswords(oldPassword, newPassword);
  return requestClient.put('/auth/password', {
    keyId,
    encryptedOldPassword: encrypted[0],
    encryptedNewPassword: encrypted[1],
  });
}
export const getCaptchaChallenge = () =>
  requestClient.get<{ challengeId: string }>('/auth/captcha');
export const verifyCaptcha = (data: {
  challengeId: string;
  username: string;
  points: { x: number; t: number }[];
}) =>
  requestClient.post<{ captchaToken: string }>('/auth/captcha/verify', data);
