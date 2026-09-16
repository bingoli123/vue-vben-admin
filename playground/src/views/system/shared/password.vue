<script setup lang="ts">
import type { Row } from '#/api/system/admin';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { getDetail, resetPassword } from '#/api/system/admin';

import { passwordRule } from './schema';
const emit = defineEmits<{ success: [] }>();
const row = ref<Row>();
const [Form, formApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'InputPassword',
      fieldName: 'password',
      label: '新密码',
      rules: passwordRule,
      help: '至少 9 个字符，包含大小写字母、数字和特殊字符',
    },
  ],
});
const [Modal, modalApi] = useVbenModal<Row>({
  async onOpenChange(open) {
    if (open) {
      row.value = undefined;
      modalApi.setState({ loading: true, showConfirmButton: false });
      await formApi.reset();
      const data = modalApi.getData();
      try {
        if (!data) return;
        row.value = await getDetail('users', data.id);
        modalApi.setState({ showConfirmButton: true });
      } finally {
        modalApi.setState({ loading: false });
      }
    }
  },
  async onConfirm() {
    if (!row.value) return;
    const validation = await formApi.validate();
    if (!validation.valid) return;
    modalApi.lock();
    try {
      const values = await formApi.getValues();
      await resetPassword(row.value, values.password);
      message.success('密码已重置，用户需重新登录');
      emit('success');
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
});
</script>
<template>
  <Modal :title="`重置密码 · ${row?.name || row?.username || ''}`">
    <Form />
  </Modal>
</template>
