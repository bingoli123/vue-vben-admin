<script setup lang="ts">
import type { Personnel } from '#/api/cadre/personnel';

import { computed, onUnmounted, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { getPersonnel } from '#/api/cadre/personnel';
const data = ref<Personnel>();
let generation = 0;
onUnmounted(() => {
  generation++;
});
const items = computed(() => [
  { label: '人员名称', content: data.value?.name },
  { label: '所属单位', content: data.value?.unitName },
  { label: '人员编号', content: data.value?.number },
  { label: '名称简拼', content: data.value?.initials ?? '未配置' },
  { label: '工号', content: data.value?.employeeNo ?? '未配置' },
  { label: '手机号', content: data.value?.phone ?? '未配置' },
  { label: '职务', content: data.value?.position ?? '未配置' },
  { label: '序号', content: data.value?.sortOrder ?? '未配置' },
  { label: '版本', content: data.value?.version },
  { label: '创建人', content: data.value?.createdBy },
  {
    label: '创建时间',
    content: data.value ? formatDateTime(data.value.createdAt) : '',
  },
  { label: '修改人', content: data.value?.updatedBy },
  {
    label: '修改时间',
    content: data.value ? formatDateTime(data.value.updatedAt) : '',
  },
]);
const [Drawer, api] = useVbenDrawer<Personnel>({
  async onOpenChange(open) {
    const request = ++generation;
    if (!open) return;
    data.value = undefined;
    api.setState({ loading: true });
    try {
      const target = api.getData();
      if (!target) return;
      const loaded = await getPersonnel(target.id);
      if (request === generation) data.value = loaded;
    } catch {
      /* 请求层提示失败，不把列表旧值当作最新详情。 */
    } finally {
      if (request === generation) api.setState({ loading: false });
    }
  },
});
</script>
<template>
  <Drawer title="管理人员详情" :footer="false">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
