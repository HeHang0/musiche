<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  value: string;
  menu: { label: string; value: any }[];
  size?: string;
}
const props = withDefaults(defineProps<Props>(), {
  value: '',
  menu: () => [] as any[],
  size: undefined
});
const emit = defineEmits({
  change: (_value: any) => true
});
const value = computed(() => props.value);

function valueChange(v: any) {
  emit('change', v);
}
</script>
<template>
  <el-radio-group :model-value="value" :size="props.size" @change="valueChange">
    <el-radio-button v-for="item in props.menu" :label="item.value">
      {{ item.label }}
    </el-radio-button>
  </el-radio-group>
</template>
<style lang="less" scoped>
.el-radio-group {
  border: 1px solid var(--music-button-info-border-color);
  border-radius: var(--music-border-radio);
}

:deep(.el-radio-button--large .el-radio-button__inner) {
  padding: 11.5px 19px !important;
  border: none;
  background-color: transparent;
  border-left: none !important;
}
:deep(.el-radio-button__inner:hover) {
  color: var(--el-button-text-color, var(--el-text-color-regular));
}
:deep(
    .el-radio-button__original-radio:checked + .el-radio-button__inner:hover
  ) {
  color: var(--el-radio-button-checked-text-color, var(--el-color-white));
}
:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border: none !important;
  background-color: transparent;
  box-shadow: none;
  background: var(--music-button-primary-background);
}
.el-radio-button + .el-radio-button {
  border-left: 1px solid var(--music-button-info-border-color);
}
</style>
