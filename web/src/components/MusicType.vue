<script setup lang="ts">
import { computed } from 'vue';
import { MusicType } from '../utils/type';
import CloudMusicImage from '../assets/images/cloud-music.webp';
import QQMusicImage from '../assets/images/qq-music.png';
import MiguMusicImage from '../assets/images/migu-music.webp';
const musicTypeImages: any = {
  cloud: CloudMusicImage,
  qq: QQMusicImage,
  migu: MiguMusicImage
};
const musicTypes = [
  {
    type: MusicType.CloudMusic,
    title: '网易云音乐'
  },
  {
    type: MusicType.QQMusic,
    title: 'QQ音乐'
  },
  {
    type: MusicType.MiguMusic,
    title: '咪咕音乐'
  }
];
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
    <el-radio-button
      v-for="musicType in musicTypes"
      :label="musicType.type"
      :title="musicType.title">
      <img
        v-if="musicTypeImages[musicType.type]"
        class="music-type-icon"
        :src="musicTypeImages[musicType.type]" />
      <span v-else>{{ musicType.title }}</span>
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
  // border: 1px solid var(--el-input-border-color, var(--el-border-color));
  box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color))
    inset;
  border-radius: var(--music-border-radio);
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
