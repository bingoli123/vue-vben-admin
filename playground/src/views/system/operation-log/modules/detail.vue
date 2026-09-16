<script setup lang="ts">
import type { OperationLog } from '#/api/system/operation-log';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  deviceTypes,
  getOperationLog,
  logLabel,
  logStates,
  operationTypes,
} from '#/api/system/operation-log';

const data = ref<OperationLog>();
const items = computed(() => {
  const row = data.value;
  if (!row) return [];
  return [
    ['日志编号', row.id],
    ['操作时间', formatDateTime(row.occurredAt)],
    ['系统模块', row.module],
    ['接口名称', row.interfaceName],
    ['操作类型', logLabel(operationTypes, row.operationType)],
    ['操作状态', logLabel(logStates, row.status)],
    ['操作者 ID', row.actorId],
    ['操作账号', row.username ?? '未认证'],
    ['操作人员', row.actorName],
    ['单位 ID', row.unitId],
    ['所属单位', row.unitName],
    ['客户端', row.clientId],
    ['设备类型', logLabel(deviceTypes, row.deviceType)],
    ['浏览器', row.browser],
    ['操作系统', row.operatingSystem],
    ['操作地址', row.address],
    ['请求方法', row.requestMethod],
    ['请求路径', row.requestPath],
    ['HTTP 状态', row.httpStatus],
    ['结果码', row.resultCode],
    ['耗时（毫秒）', row.durationMs],
    ['追踪编号', row.traceId],
  ].map(([label, content]) => ({
    label: String(label),
    content: content ?? '未知',
  }));
});
const [Drawer, api] = useVbenDrawer<OperationLog>({
  async onOpenChange(open) {
    data.value = undefined;
    if (!open) return;
    const row = api.getData();
    if (!row) return;
    api.setState({ loading: true });
    try {
      data.value = await getOperationLog(row.id);
    } finally {
      api.setState({ loading: false });
    }
  },
});
</script>
<template>
  <Drawer title="操作日志详情" :footer="false">
<VbenDescriptions bordered :column="1" :items="items" />
</Drawer>
</template>
