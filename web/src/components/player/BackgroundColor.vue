<template>
  <div class="music-background-color"></div>
</template>
<style lang="less" scoped>
.music-background-color {
  width: 100vw;
  height: 100vh;
  object-fit: cover;
  position: fixed;
  left: 0;
  top: 0;
  opacity: 0.6;
  background: linear-gradient(
    to bottom,
    var(--music-slider-color-end),
    var(--music-slider-color-start)
  );
}
</style>
