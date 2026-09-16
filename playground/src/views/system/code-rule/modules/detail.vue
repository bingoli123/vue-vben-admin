<script setup lang="ts">
import type { CodeRule } from '#/api/system/code-rule';

import { computed, onUnmounted, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { getCodeRule } from '#/api/system/code-rule';

const data = ref<CodeRule>();
let generation = 0;
onUnmounted(() => {
  generation++;
});
const items = computed(() => [
  { label: '业务名称', content: data.value?.name },
  { label: '业务标识', content: data.value?.code },
  { label: '业务前缀', content: data.value?.prefix || '无' },
  { label: '数字长度', content: data.value?.numericLength },
  { label: '当前已发流水号', content: data.value?.currentSerial },
  {
    label: '发号状态',
    content: data.value?.currentSequence === '0' ? '尚未发号' : '已开始发号',
  },
  { label: '版本', content: data.value?.version },
  {
    label: '创建时间',
    content: data.value ? formatDateTime(data.value.createdAt) : '',
  },
  {
    label: '最后修改或取号时间',
    content: data.value ? formatDateTime(data.value.updatedAt) : '',
  },
]);
const [Drawer, api] = useVbenDrawer<CodeRule>({
  async onOpenChange(open) {
    const request = ++generation;
    if (!open) return;
    data.value = undefined;
    api.setState({ loading: true });
    try {
      const selected = api.getData();
      if (!selected) return;
      const loaded = await getCodeRule(selected.id);
      if (request === generation) data.value = loaded;
    } catch {
      // 详情读取失败不回显列表中的旧进度，由请求层提示错误。
    } finally {
      if (request === generation) api.setState({ loading: false });
    }
  },
});
</script>
<template>
  <Drawer title="编码规则详情" :footer="false">
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
