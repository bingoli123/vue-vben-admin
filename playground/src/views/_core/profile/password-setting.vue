<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { message, Spin } from 'antdv-next';

import { changePassword } from '#/api';
import { useAuthStore } from '#/store';
import { passwordRule } from '#/views/system/shared/schema';
const busy = ref(false);
const auth = useAuthStore();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'oldPassword',
      label: '旧密码',
      rules: 'required',
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请输入旧密码',
      },
    },
    {
      fieldName: 'newPassword',
      label: '新密码',
      rules: passwordRule,
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
    },
    {
      fieldName: 'confirmPassword',
      label: '确认密码',
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请再次输入新密码',
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({ error: '请再次输入新密码' })
            .min(1, { message: '请再次输入新密码' })
            .refine((value) => value === newPassword, {
              message: '两次输入的密码不一致',
            });
        },
        triggerFields: ['newPassword'],
      },
    },
  ];
});

async function handleSubmit(values: Record<string, any>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await changePassword(values.oldPassword, values.newPassword);
    message.success('密码已修改，请重新登录');
    await auth.clearSession(false);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Spin :spinning="busy">
    <ProfilePasswordSetting
      class="max-w-xl"
      :form-schema="formSchema"
      @submit="handleSubmit"
    />
  </Spin>
</template>
