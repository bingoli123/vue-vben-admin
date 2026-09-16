<script setup lang="ts">
import type { Option, Row } from '#/api/system/admin';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Tree, useVbenDrawer } from '@vben/common-ui';

import { Alert, message, TabPane, Tabs } from 'antdv-next';

import {
  asTree,
  getRoleMenus,
  getRoleUnits,
  getUserRoles,
  menuOptions,
  roleOptions,
  saveRoleGrants,
  saveUserRoles,
  unitOptions,
} from '#/api/system/admin';
const emit = defineEmits<{ success: [] }>();
const { hasAccessByCodes } = useAccess();
const current = ref<Row>();
const mode = ref<'roles' | 'users'>('roles');
const version = ref(0);
const menus = ref<string[]>([]);
const units = ref<string[]>([]);
const roles = ref<string[]>([]);
const menuItems = ref<Option[]>([]);
const unitItems = ref<Option[]>([]);
const roleItems = ref<Option[]>([]);
const canMenu = computed(
  () => mode.value === 'roles' && hasAccessByCodes(['platform:role:authorize']),
);
const canUnit = computed(
  () => mode.value === 'roles' && hasAccessByCodes(['platform:role:units']),
);
const ready = ref(false);
const activeTab = ref('menus');
function merge(items: any[], selected: any[], ids: string[]): Option[] {
  const map = new Map(items.map((i) => [i.id, i]));
  for (const i of selected)
    if (!map.has(i.id)) map.set(i.id, { ...i, enabled: false });
  for (const id of ids)
    if (!map.has(id))
      map.set(id, { id, name: `已失效项目 ${id}`, enabled: false });
  return [...map.values()];
}
function choices(items: Option[], selected: string[]) {
  // 历史失效授权可回显和移除，不能新选；禁用已选项会导致原生树丢失它们。
  return asTree(
    items.map((i) => ({
      ...i,
      name: i.enabled ? i.name : `${i.name}（已失效）`,
      disabled: !i.enabled && !selected.includes(i.id),
    })),
  );
}
const menuTree = computed(() => choices(menuItems.value, menus.value));
const unitTree = computed(() => choices(unitItems.value, units.value));
const roleTree = computed(() => choices(roleItems.value, roles.value));
const [Drawer, drawerApi] = useVbenDrawer<{
  kind: 'roles' | 'users';
  row: Row;
}>({
  async onOpenChange(open) {
    if (!open) return;
    const data = drawerApi.getData();
    if (!data) return;
    current.value = data.row;
    mode.value = data.kind;
    ready.value = false;
    drawerApi.setState({ loading: true, showConfirmButton: false });
    menus.value = [];
    units.value = [];
    roles.value = [];
    try {
      if (mode.value === 'users') {
        const [binding, options] = await Promise.all([
          getUserRoles(data.row.id),
          roleOptions(),
        ]);
        version.value = binding.version;
        roles.value = binding.selectedIds;
        roleItems.value = merge(options, binding.selected, binding.selectedIds);
      } else {
        const versions: number[] = [];
        if (canMenu.value) {
          const [binding, options] = await Promise.all([
            getRoleMenus(data.row.id),
            menuOptions(),
          ]);
          versions.push(binding.version);
          menus.value = binding.menuIds;
          menuItems.value = merge(options, binding.menus, binding.menuIds);
        }
        if (canUnit.value) {
          const [binding, options] = await Promise.all([
            getRoleUnits(data.row.id),
            unitOptions(),
          ]);
          versions.push(binding.version);
          units.value = binding.selectedIds;
          unitItems.value = merge(
            options,
            binding.selected,
            binding.selectedIds,
          );
        }
        if (versions.length === 0 || versions.some((v) => v !== versions[0])) {
          message.warning('授权资料已变化，请关闭后重新打开');
          return;
        }
        version.value = versions[0] ?? 0;
        activeTab.value = canMenu.value ? 'menus' : 'units';
      }
      ready.value = true;
      drawerApi.setState({ showConfirmButton: true });
    } finally {
      drawerApi.setState({ loading: false });
    }
  },
  async onConfirm() {
    if (!ready.value || !current.value) return;
    drawerApi.lock();
    try {
      const save =
        mode.value === 'users'
          ? saveUserRoles(current.value.id, version.value, roles.value)
          : saveRoleGrants(current.value.id, {
              version: version.value,
              ...(canMenu.value ? { menuIds: menus.value } : {}),
              ...(canUnit.value ? { unitIds: units.value } : {}),
            });
      await save;
      emit('success');
      drawerApi.close();
      message.success('授权已保存，受影响用户需重新登录');
    } finally {
      drawerApi.unlock();
    }
  },
});
</script>
<template>
  <Drawer
    class="w-full max-w-200"
    :title="`${current?.name || ''} · ${mode === 'users' ? '分配角色' : '角色授权'}`"
  >
    <Alert
      class="mb-4"
      type="info"
      :message="
        mode === 'users'
          ? '角色决定功能权限与单位范围；固定管理员身份不能通过角色赋予。'
          : '功能权限父子联动：部分子项选中时上级半选，全部子项选中时上级全选；单位范围包含所选单位的有效下级。两组一起保存。'
      "
    />
    <template v-if="ready">
      <Tree
        v-if="mode === 'users'"
        v-model="roles"
        :tree-data="roleTree"
        select-all-label="全选角色"
        multiple
        check-strictly
        :auto-check-parent="false"
        value-field="id"
        label-field="name"
        bordered
      />
      <Tabs v-else v-model:active-key="activeTab">
        <TabPane v-if="canMenu" key="menus" tab="功能权限">
          <Tree
            v-model="menus"
            :tree-data="menuTree"
            select-all-label="全选功能权限"
            multiple
            :check-strictly="false"
            :auto-check-parent="false"
            include-indeterminate
            value-field="id"
            label-field="name"
            :default-expanded-level="2"
            bordered
          />
        </TabPane>
        <TabPane v-if="canUnit" key="units" tab="单位数据范围">
          <Tree
            v-model="units"
            :tree-data="unitTree"
            select-all-label="全选单位"
            multiple
            check-strictly
            :auto-check-parent="false"
            value-field="id"
            label-field="name"
            :default-expanded-level="2"
            bordered
          />
        </TabPane>
      </Tabs>
    </template>
  </Drawer>
</template>
