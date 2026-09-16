<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Spin } from 'antdv-next';

import { requestClient } from '#/api/request';
const route = useRoute();
const errorMessage = ref('');
const loading = ref(false);
const source = ref('');
let revision = 0;
async function open() {
  const current = ++revision;
  source.value = '';
  errorMessage.value = '';
  loading.value = true;
  try {
    const result = await requestClient.post<{ name: string; url: string }>(
      `/reports/menus/${String(route.meta.menuId)}/open`,
    );
    const url = new URL(result.url, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/ureport/'))
      throw new Error('报表地址无效');
    if (current === revision) source.value = url.href;
  } catch (error) {
    if (current === revision)
      errorMessage.value =
        error instanceof Error ? error.message : '报表打开失败';
  } finally {
    if (current === revision) loading.value = false;
  }
}
watch(() => route.meta.menuId, open, { immediate: true });
onBeforeUnmount(() => {
  revision++;
});
</script>
<template>
  <Page auto-content-height content-class="overflow-hidden p-0">
    <Spin
      :spinning="loading"
      class="size-full"
      :styles="{ container: { height: '100%', width: '100%' } }"
    >
      <div v-if="errorMessage" class="p-4">
        <Alert :message="errorMessage" type="error" class="mb-4" />
        <Button @click="open">重新打开报表</Button>
      </div>
      <iframe
        v-else-if="source"
        :src="source"
        :title="String(route.meta.title)"
        class="block size-full border-0 bg-white"
      ></iframe>
    </Spin>
  </Page>
</template>
