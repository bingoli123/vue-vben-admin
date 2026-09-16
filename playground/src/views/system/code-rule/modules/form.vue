<script setup lang="ts">
import type { CodeRule } from '#/api/system/code-rule';

import { computed, nextTick, onUnmounted, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { getCodeRule, saveCodeRule } from '#/api/system/code-rule';

import { formSchema } from '../data';

const emit = defineEmits<{ success: [] }>();
const current = ref<CodeRule>();
const ready = ref(false);
let saved = false;
// 每次开关抽屉都使旧请求失效，避免慢响应把前一次规则写回当前表单。
let generation = 0;
onUnmounted(() => {
  generation++;
});
const [Form, formApi] = useVbenForm({
  schema: formSchema(),
  showDefaultActions: false,
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 110 },
  wrapperClass: 'grid-cols-1',
});
const [Drawer, drawerApi] = useVbenDrawer<Partial<CodeRule>>({
  async onOpenChange(open) {
    const request = ++generation;
    if (!open) {
      ready.value = false;
      return;
    }
    ready.value = false;
    saved = false;
    current.value = undefined;
    drawerApi.setState({ loading: true, showConfirmButton: false });
    try {
      const data = drawerApi.getData();
      const loaded = data?.id ? await getCodeRule(data.id) : undefined;
      if (request !== generation) return;
      current.value = loaded;
      await formApi.reset();
      if (request !== generation) return;
      formApi.setState({ schema: formSchema(current.value) });
      await nextTick();
      if (request !== generation) return;
      await formApi.setValues(
        current.value ?? { name: '', code: '', numericLength: 6, prefix: '' },
      );
      if (request !== generation) return;
      ready.value = true;
      drawerApi.setState({ showConfirmButton: true });
    } catch {
      // 请求层负责中文错误提示；详情失败时保持不可提交，防止误建新规则。
    } finally {
      if (request === generation) drawerApi.setState({ loading: false });
    }
  },
  onClosed() {
    // 等待抽屉关闭后刷新列表，保存失败和取消均不触发成功通知。
    if (saved) {
      saved = false;
      emit('success');
    }
  },
  async onConfirm() {
    if (!ready.value) return;
    const validation = await formApi.validate();
    if (!validation.valid) return;
    drawerApi.lock();
    try {
      await saveCodeRule(await formApi.getValues(), current.value);
      saved = true;
      message.success('编码规则已保存');
      await drawerApi.close();
    } catch (error) {
      // 持续发号也会推进版本，冲突后必须重新打开读取最新进度，不能强制覆盖。
      if (
        (error as { response?: { data?: { code?: string } } }).response?.data
          ?.code === 'VERSION_CONFLICT'
      ) {
        ready.value = false;
        drawerApi.setState({ showConfirmButton: false });
      }
      // 请求层已展示错误；事件回调不再抛出未处理的 Promise 拒绝。
    } finally {
      drawerApi.unlock();
    }
  },
});
const title = computed(() => `${current.value ? '编辑' : '新增'}编码规则`);
</script>
<template>
  <Drawer :title="title" class="w-full max-w-160">
    <div class="mx-4">
      <Alert
        class="mb-5"
        type="info"
        message="流水号持续递增。修改业务标识、前缀或加长数字长度后，累计进度保持不变。"
      />
      <p v-if="current" class="mb-4">
        当前已发流水号：<span class="font-mono">{{
          current.currentSerial
        }}</span>
        · 版本 {{ current.version }}
      </p>
      <Form />
    </div>
  </Drawer>
</template>
