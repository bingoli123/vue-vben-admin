<script setup lang="ts">
import type { Row } from '#/api/system/admin';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { getDetail, saveRecord } from '#/api/system/admin';

import { schemaFor } from '../../shared/schema';
const emit = defineEmits<{ success: [] }>();
const current = ref<Row>();
const ready = ref(false);
const [Form, formApi] = useVbenForm({
  schema: schemaFor('menus'),
  showDefaultActions: false,
  commonConfig: { formItemClass: 'col-span-2 md:col-span-1' },
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Drawer, drawerApi] = useVbenDrawer<Partial<Row>>({
  async onOpenChange(open) {
    if (!open) return;
    ready.value = false;
    drawerApi.setState({ loading: true, showConfirmButton: false });
    try {
      const data = drawerApi.getData();
      current.value = data?.id ? await getDetail('menus', data.id) : undefined;
      await formApi.reset();
      formApi.setState({ schema: schemaFor('menus', current.value) });
      await nextTick();
      await formApi.setValues(
        current.value ?? {
          enabled: true,
          sortOrder: 0,
          menuType: data?.menuType || 'C',
          pageType: '普通页面',
          platformType: '管理端',
          ...data,
        },
      );
      ready.value = true;
      drawerApi.setState({ showConfirmButton: true });
    } finally {
      drawerApi.setState({ loading: false });
    }
  },
  async onConfirm() {
    if (!ready.value) return;
    const validation = await formApi.validate();
    if (!validation.valid) return;
    drawerApi.lock();
    try {
      await saveRecord('menus', await formApi.getValues(), current.value);
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
});
const title = computed(() => `${current.value ? '编辑' : '新增'}菜单`);
</script>
<template>
  <Drawer class="w-full max-w-200" :title="title"><Form class="mx-4" /></Drawer>
</template>
