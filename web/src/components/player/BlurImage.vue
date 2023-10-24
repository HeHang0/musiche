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
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  position: fixed;
  left: 0;
  top: 0;
  opacity: 0.6;
  background-color: white;
  filter: blur(26px);
  // transform: scale(1.1);
  & > img {
    width: 100%;
    height: calc(100% - 10px);
    object-fit: cover;
  }
}
</style>
