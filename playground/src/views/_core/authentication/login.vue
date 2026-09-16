<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, markRaw, onMounted, ref, useTemplateRef } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';

import { message } from 'antdv-next';

import { getCaptchaChallenge, verifyCaptcha } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });
const authStore = useAuthStore();
const loginRef =
  useTemplateRef<InstanceType<typeof AuthenticationLogin>>('loginRef');
const challenge = ref('');
const ticket = ref('');
const username = ref('');
const ready = ref(false);
let revision = 0;
async function reloadCaptcha() {
  const current = ++revision;
  ready.value = false;
  ticket.value = '';
  challenge.value = '';
  const form = loginRef.value?.getFormApi();
  form?.setFieldValue('captcha', false, false);
  form
    ?.getFieldComponentRef<InstanceType<typeof SliderCaptcha>>('captcha')
    ?.resume();
  try {
    const result = await getCaptchaChallenge();
    if (current === revision) {
      challenge.value = result.challengeId;
      ready.value = true;
    }
  } catch {
    /* 请求层提示错误；重新拖动前需重试获取挑战。 */
  }
}
async function verify(points: { x: number; t: number }[]) {
  const current = revision;
  const values = await loginRef.value?.getFormApi().getValues();
  const account = String(values?.username ?? '').trim();
  if (!account) {
    message.warning('请先填写账号');
    await reloadCaptcha();
    return false;
  }
  try {
    const result = await verifyCaptcha({
      challengeId: challenge.value,
      username: account,
      points,
    });
    if (current !== revision) return false;
    if (account !== username.value.trim()) {
      await reloadCaptcha();
      return false;
    }
    ticket.value = result.captchaToken;
    return true;
  } catch {
    if (current === revision) await reloadCaptcha();
    return false;
  }
}
const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    fieldName: 'username',
    label: '账号',
    componentProps: { placeholder: '请输入账号', autocomplete: 'username' },
    rules: z.string().trim().min(1, '请输入账号').max(64),
    dependencies: {
      triggerFields: ['username'],
      trigger(values) {
        const next = String(values.username ?? '');
        if (next !== username.value) {
          username.value = next;
          // 校验请求期间切换账号也必须丢弃旧账号票据。
          if (ticket.value) void reloadCaptcha();
        }
      },
    },
  },
  {
    component: 'VbenInputPassword',
    fieldName: 'password',
    label: '密码',
    componentProps: {
      placeholder: '请输入密码',
      autocomplete: 'current-password',
    },
    rules: z.string().min(1, '请输入密码'),
  },
  {
    component: markRaw(SliderCaptcha),
    fieldName: 'captcha',
    componentProps: { disabled: !ready.value, verify },
    rules: z
      .boolean()
      .refine((value) => value && !!ticket.value, '请完成滑块验证'),
  },
]);
async function onSubmit(params: Recordable<any>) {
  try {
    await authStore.authLogin({ ...params, captchaToken: ticket.value });
  } catch {
    await reloadCaptcha();
  }
}
onMounted(reloadCaptcha);
</script>
<template>
  <div>
    <AuthenticationLogin
      ref="loginRef"
      :form-schema="formSchema"
      :loading="authStore.loginLoading"
      :show-code-login="false"
      :show-forget-password="false"
      :show-qrcode-login="false"
      :show-register="false"
      :show-third-party-login="false"
      @submit="onSubmit"
    />
    <button
      v-if="!ready"
      class="mt-2 text-sm text-primary"
      @click="reloadCaptcha"
    >
      重新加载滑块验证
    </button>
  </div>
</template>
