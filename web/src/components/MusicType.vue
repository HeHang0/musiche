<script setup lang="ts">
import { computed } from 'vue';
import { MusicType } from '../utils/type';
import { musicTypeInfoAll } from '../utils/platform';
import { useRouter } from 'vue-router';
import { useSettingStore } from '../stores/setting';
interface Props {
  value: MusicType;
  size?: string;
}
const props = withDefaults(defineProps<Props>(), {
  value: 'cloud',
  size: undefined
});
const { currentRoute } = useRouter();
const setting = useSettingStore();
const emit = defineEmits({
  change: (_value: MusicType) => true
});
const value = computed(() => props.value);

function valueChange(v: MusicType) {
  emit('change', v);
}
</script>
<template>
  <el-radio-group :model-value="value" :size="props.size" @change="valueChange">
    <template v-for="info in musicTypeInfoAll">
      <el-radio-button
        v-if="
          currentRoute.meta.key !== 'yours' || setting.userInfo[info.type].id
        "
        :value="info.type"
        :title="info.name">
        <img class="music-type-icon" v-if="info.image" :src="info.image" />
        <span v-else>{{ info.name }}</span>
      </el-radio-button>
    </template>
  </el-radio-group>
</template>
<style lang="less" scoped>
.music-type-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.el-radio-group {
  // border: 1px solid var(--el-input-border-color, var(--el-border-color));
  box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color))
    inset;
  border-radius: var(--music-border-radius);
  margin-right: 0;
  margin-left: 10px;
}

:deep(.el-radio-button--large .el-radio-button__inner) {
  padding: 6.5px 15px !important;
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
  border-left: 1px solid var(--el-input-border-color, var(--el-border-color));
}
</style>
