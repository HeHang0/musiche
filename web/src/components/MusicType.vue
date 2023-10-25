<script setup lang="ts">
import { computed } from 'vue';
import { MusicType } from '../utils/type';
interface Props {
  value: string;
  size?: string;
}
const props = withDefaults(defineProps<Props>(), {
  value: MusicType.CloudMusic,
  size: undefined
});
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
    <el-radio-button :label="MusicType.CloudMusic" title="网易云音乐">
      <img class="music-type-icon" src="../assets/images/cloud-music.webp" />
    </el-radio-button>
    <el-radio-button :label="MusicType.QQMusic" title="QQ音乐">
      <img class="music-type-icon" src="../assets/images/qq-music.png" />
    </el-radio-button>
    <el-radio-button :label="MusicType.MiguMusic" title="咪咕音乐">
      <img class="music-type-icon" src="../assets/images/migu-music.webp" />
    </el-radio-button>
  </el-radio-group>
</template>
<style lang="less" scoped>
.music-type-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.el-radio-group {
  border: 1px solid var(--music-button-info-border-color);
  border-radius: var(--music-border-radio);
  width: 155px;
}

:deep(.el-radio-button--large .el-radio-button__inner) {
  padding: 8px 15px !important;
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
