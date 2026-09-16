<script setup lang="ts">
import type { FormInstance } from 'antdv-next';

import type { Folder, FolderUnit } from '#/api/documents/folders';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import Alert from 'antdv-next/dist/alert/index';
import Button from 'antdv-next/dist/button/index';
import Card from 'antdv-next/dist/card/index';
import Descriptions, {
  DescriptionsItem,
} from 'antdv-next/dist/descriptions/index';
import Empty from 'antdv-next/dist/empty/index';
import Form, { FormItem } from 'antdv-next/dist/form/index';
import InputNumber from 'antdv-next/dist/input-number/index';
import Input from 'antdv-next/dist/input/index';
import message from 'antdv-next/dist/message/index';
import Modal from 'antdv-next/dist/modal/index';
import Space from 'antdv-next/dist/space/index';
import Spin from 'antdv-next/dist/spin/index';
import Table from 'antdv-next/dist/table/index';
import TreeSelect from 'antdv-next/dist/tree-select/index';
import Tree from 'antdv-next/dist/tree/index';

import {
  deleteFolder,
  folderPermission,
  getFolder,
  getFolders,
  getFolderUnits,
  saveFolder,
} from '#/api/documents/folders';

import { folderDescendants, folderTree } from './tree';

const { hasAccessByCodes } = useAccess();
const can = (action: string) => hasAccessByCodes([folderPermission(action)]);
const rows = ref<Folder[]>([]);
const selected = ref<Folder>();
const selectedKeys = ref<string[]>([]);
const expandedKeys = ref<string[]>([]);
const loading = ref(false);
const detailLoading = ref(false);
const tree = computed(() => folderTree(rows.value));
// 当前目录仅展示直接子文件夹，后续文件列表也必须按当前 folderId 查询。
const contents = computed(() =>
  rows.value.filter((row) => row.parentId === selected.value?.id),
);
let listRequest = 0;
let detailRequest = 0;

async function select(id?: string) {
  const current = ++detailRequest;
  selected.value = undefined;
  selectedKeys.value = id ? [id] : [];
  if (!id) {
    detailLoading.value = false;
    return;
  }
  // 新增、移动或刷新后展开选中节点的祖先链，保持选中项可见。
  let ancestor = rows.value.find((row) => row.id === id)?.parentId;
  const visited = new Set<string>();
  while (ancestor && !visited.has(ancestor)) {
    visited.add(ancestor);
    if (!expandedKeys.value.includes(ancestor))
      expandedKeys.value.push(ancestor);
    ancestor = rows.value.find((row) => row.id === ancestor)?.parentId;
  }
  detailLoading.value = true;
  try {
    const folder = await getFolder(id);
    if (current === detailRequest) selected.value = folder;
  } catch {
    if (current === detailRequest) selectedKeys.value = [];
  } finally {
    if (current === detailRequest) detailLoading.value = false;
  }
}
async function reload(preferred?: string) {
  if (!can('query')) return;
  const current = ++listRequest;
  loading.value = true;
  try {
    const next = await getFolders();
    if (current !== listRequest) return;
    rows.value = next;
    const ids = new Set(next.map((row) => row.id));
    expandedKeys.value = expandedKeys.value.filter((id) => ids.has(id));
    const desired = preferred ?? selectedKeys.value[0];
    const target = desired && ids.has(desired) ? desired : next[0]?.id;
    await select(target);
  } catch {
    if (current === listRequest) {
      rows.value = [];
      await select();
    }
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
onMounted(() => reload());

const formRef = ref<FormInstance>();
const modalOpen = ref(false);
const saving = ref(false);
const opening = ref(false);
const existing = ref<Folder>();
const units = ref<FolderUnit[]>([]);
const form = reactive({
  name: '',
  parentId: undefined as string | undefined,
  unitId: undefined as string | undefined,
  sortOrder: 0,
  description: '',
});
const parentOptions = computed(() => {
  const excluded = folderDescendants(rows.value, existing.value?.id);
  return folderTree(
    rows.value.filter(
      (row) =>
        !excluded.has(row.id) &&
        (!existing.value || row.unitId === existing.value.unitId),
    ),
  );
});
const unitTree = computed(() => folderTree(units.value));
watch(
  () => form.parentId,
  (parent) => {
    if (parent)
      form.unitId = rows.value.find((row) => row.id === parent)?.unitId;
  },
);
async function openForm(mode: 'child' | 'edit' | 'root') {
  opening.value = true;
  try {
    const [options, current] = await Promise.all([
      getFolderUnits(),
      mode === 'edit' && selected.value
        ? getFolder(selected.value.id)
        : undefined,
    ]);
    units.value = options;
    existing.value = current;
    Object.assign(
      form,
      current
        ? {
            name: current.name,
            parentId: current.parentId ?? undefined,
            unitId: current.unitId,
            sortOrder: current.sortOrder,
            description: current.description ?? '',
          }
        : {
            name: '',
            parentId: mode === 'child' ? selected.value?.id : undefined,
            unitId: mode === 'child' ? selected.value?.unitId : undefined,
            sortOrder: 0,
            description: '',
          },
    );
    modalOpen.value = true;
  } finally {
    opening.value = false;
  }
}
async function submit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const saved = await saveFolder(
      {
        name: form.name.trim(),
        parentId: form.parentId ?? null,
        unitId: form.unitId ?? null,
        sortOrder: form.sortOrder,
        description: form.description || null,
        version: existing.value?.version,
      },
      existing.value?.id,
    );
    modalOpen.value = false;
    message.success('文件夹已保存');
    await reload(saved.id);
  } finally {
    saving.value = false;
  }
}
function remove() {
  const folder = selected.value;
  if (!folder) return;
  Modal.confirm({
    title: '删除文件夹',
    content: `确认删除“${folder.name}”？仅空文件夹可以删除。`,
    async onOk() {
      await deleteFolder(folder);
      message.success('文件夹已删除');
      await reload(folder.parentId ?? undefined);
    },
  });
}
const columns = [
  { title: '文件夹名称', key: 'name', dataIndex: 'name' },
  { title: '所属单位', key: 'unitName', dataIndex: 'unitName' },
  { title: '排序号', key: 'sortOrder', dataIndex: 'sortOrder', width: 100 },
];
const displayTime = (time: string) => new Date(time).toLocaleString();
</script>

<template>
  <Page>
    <Alert
      v-if="!can('query')"
      class="mb-4"
      type="info"
      message="当前账号尚未授予文件夹查询权限。"
    />
    <div class="flex flex-col gap-4 lg:flex-row">
      <Card title="文件夹" class="w-full shrink-0 lg:w-80">
        <Space class="mb-4" wrap>
          <Button
            v-if="can('add')"
            type="primary"
            :loading="opening"
            @click="openForm('root')"
          >
            新增根文件夹
          </Button>
          <Button v-if="can('query')" :loading="loading" @click="reload()">
            刷新
          </Button>
        </Space>
        <Spin :spinning="loading">
          <Tree
            v-if="tree.length"
            v-model:expanded-keys="expandedKeys"
            :selected-keys="selectedKeys"
            :tree-data="tree"
            block-node
            @select="
              (keys) => select(keys[0] ? String(keys[0]) : selectedKeys[0])
            "
          />
          <Empty v-else description="暂无可查看的文件夹" />
        </Spin>
      </Card>
      <div class="min-w-0 flex-1 space-y-4">
        <Card title="文件夹详情" :loading="detailLoading">
          <template v-if="selected" #extra>
            <Space wrap>
              <Button
                v-if="can('add')"
                :loading="opening"
                @click="openForm('child')"
              >
                新增子文件夹
              </Button>
              <Button
                v-if="can('edit')"
                :loading="opening"
                @click="openForm('edit')"
              >
                编辑
              </Button>
              <Button v-if="can('delete')" danger @click="remove">删除</Button>
            </Space>
          </template>
          <Descriptions v-if="selected" :column="2" bordered size="small">
            <DescriptionsItem label="文件夹名称">
              {{ selected.name }}
            </DescriptionsItem>
            <DescriptionsItem label="所属单位">
              {{ selected.unitName }}
            </DescriptionsItem>
            <DescriptionsItem label="上级文件夹">
              {{
                rows.find((row) => row.id === selected?.parentId)?.name ??
                '根文件夹'
              }}
            </DescriptionsItem>
            <DescriptionsItem label="排序号">
              {{ selected.sortOrder }}
            </DescriptionsItem>
            <DescriptionsItem label="创建时间">
              {{ displayTime(selected.createdAt) }}
            </DescriptionsItem>
            <DescriptionsItem label="修改时间">
              {{ displayTime(selected.updatedAt) }}
            </DescriptionsItem>
            <DescriptionsItem label="说明" :span="2">
              {{ selected.description || '—' }}
            </DescriptionsItem>
          </Descriptions>
          <Empty v-else description="请选择左侧文件夹" />
        </Card>
        <Card
          :title="
            selected ? `当前文件夹内容 · ${selected.name}` : '当前文件夹内容'
          "
        >
          <Table
            v-if="selected && contents.length"
            :columns="columns"
            :data-source="contents"
            row-key="id"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <Button
                v-if="column.key === 'name'"
                type="link"
                @click="select(record.id)"
              >
                {{ record.name }}
              </Button>
            </template>
          </Table>
          <Empty
            v-else
            :description="
              selected ? '当前文件夹暂无内容' : '选择文件夹后查看当前目录内容'
            "
          />
        </Card>
      </div>
    </div>
    <Modal
      v-model:open="modalOpen"
      :title="existing ? '编辑文件夹' : '新增文件夹'"
      :confirm-loading="saving"
      :mask-closable="false"
      :cancel-button-props="{ disabled: saving }"
      :closable="!saving"
      destroy-on-hidden
      @ok="submit"
    >
      <Form ref="formRef" :model="form" layout="vertical" class="mt-4">
        <FormItem
          label="文件夹名称"
          name="name"
          :rules="[
            { required: true, whitespace: true, message: '请填写文件夹名称' },
          ]"
        >
          <Input v-model:value="form.name" :maxlength="200" />
        </FormItem>
        <FormItem label="上级文件夹" name="parentId">
          <TreeSelect
            v-model:value="form.parentId"
            :tree-data="parentOptions"
            allow-clear
            placeholder="不选表示根文件夹"
            tree-default-expand-all
          />
        </FormItem>
        <FormItem
          label="所属单位"
          name="unitId"
          :rules="[{ required: true, message: '请选择所属单位' }]"
        >
          <Input
            v-if="form.parentId"
            :value="rows.find((row) => row.id === form.parentId)?.unitName"
            disabled
          />
          <TreeSelect
            v-else
            v-model:value="form.unitId"
            :tree-data="unitTree"
            placeholder="请选择有权维护的单位"
            tree-default-expand-all
          />
          <div v-if="form.parentId" class="text-muted-foreground mt-1 text-xs">
            继承上级文件夹的所属单位
          </div>
          <div v-else-if="existing" class="text-muted-foreground mt-1 text-xs">
            修改所属单位将同时更新该文件夹下的全部子文件夹。
          </div>
        </FormItem>
        <FormItem
          label="排序号"
          name="sortOrder"
          :rules="[{ required: true, message: '请填写排序号' }]"
        >
          <InputNumber
            v-model:value="form.sortOrder"
            :min="0"
            :max="2147483647"
            :precision="0"
            class="w-full"
          />
        </FormItem>
        <FormItem label="说明" name="description">
          <Input.TextArea
            v-model:value="form.description"
            :maxlength="1000"
            :rows="3"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
