<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { Profile } from '#/api/core/user';

import { onMounted, ref, useTemplateRef } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Avatar, Button, message, Spin, Upload } from 'antdv-next';

import { getProfile, updateProfile, uploadAvatar } from '#/api';
import { useAuthStore } from '#/store';
const auth = useAuthStore();
const users = useUserStore();
const profile = ref<Profile>();
const busy = ref(false);
const base = useTemplateRef<InstanceType<typeof ProfileBaseSetting>>('base');
const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: '姓名',
    componentProps: { maxlength: 200 },
  },
  {
    component: 'AutoComplete',
    fieldName: 'gender',
    label: '性别',
    componentProps: {
      options: [{ value: '男' }, { value: '女' }],
      maxlength: 32,
    },
  },
  ...[
    ['username', '账号'],
    ['employeeNo', '工号'],
    ['unitName', '所属单位'],
    ['roleNames', '角色'],
  ].map(
    ([fieldName, label]) =>
      ({
        component: 'Input',
        fieldName: fieldName ?? '',
        label,
        componentProps: { disabled: true },
      }) as VbenFormSchema,
  ),
];
async function load() {
  profile.value = await getProfile();
  await base.value
    ?.getFormApi()
    .setValues({ ...profile.value, roleNames: users.userRoles.join('、') });
}
async function save(values: Record<string, any>) {
  if (busy.value || !profile.value) return;
  busy.value = true;
  try {
    profile.value = await updateProfile({
      name: values.name ?? '',
      gender: values.gender ?? '',
      version: profile.value.version,
    });
    await auth.fetchUserInfo();
    message.success('资料已保存');
    await load();
  } finally {
    busy.value = false;
  }
}
async function beforeUpload(file: File) {
  if (busy.value || !profile.value) return false;
  busy.value = true;
  try {
    profile.value = await uploadAvatar(file, profile.value.version);
    await auth.fetchUserInfo();
    await load();
    message.success('头像已更新');
  } finally {
    busy.value = false;
  }
  return false;
}
onMounted(load);
</script>
<template>
  <Spin :spinning="busy">
    <div class="max-w-2xl">
      <div class="mb-6 flex items-center gap-4">
        <Avatar :src="users.userInfo?.avatar" :size="80">
          {{ profile?.name?.slice(0, 1) || profile?.username?.slice(0, 1) }}
        </Avatar>
        <div>
          <Upload
            accept="image/png,image/jpeg"
            :show-upload-list="false"
            :before-upload="beforeUpload"
          >
            <Button :disabled="busy">
              <IconifyIcon icon="lucide:upload" class="mr-2 size-4" />上传头像
            </Button>
          </Upload>
          <p class="mt-2 text-sm text-muted-foreground">
            支持 PNG、JPEG，最大 2 MB
          </p>
        </div>
      </div>
      <ProfileBaseSetting ref="base" :form-schema="schema" @submit="save" />
    </div>
  </Spin>
</template>
