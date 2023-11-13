<script lang="ts" setup>
interface Props {
  src: string;
}
const props = withDefaults(defineProps<Props>(), {
  src: ''
});
</script>
<template>
  <div class="music-background-blur-image">
    <img :src="props.src" />
  </div>
</template>
<style lang="less" scoped>
.music-background-blur-image {
  object-fit: cover;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  opacity: 0.6;
  background-color: var(--music-slider-color-end, var(--music-background));
  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(26px);
  }
}
</style>
