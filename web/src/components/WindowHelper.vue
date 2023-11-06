<script lang="ts" setup>
import { webView2Services } from '../utils/utils';
function startResize(direction: number, e?: MouseEvent) {
  if (e && e.button == 0 && e.buttons == 1)
    webView2Services.specialService?.ResizeWindow(direction);
}
</script>
<template>
  <div v-if="webView2Services.enabled" class="music-window-helper">
    <div
      class="music-window-helper-drag"
      style="-webkit-app-region: drag"></div>
    <!-- @mousedown.stop="startDrag" -->
    <div
      class="music-window-helper-l"
      @mousedown.stop="startResize(1, $event)"></div>
    <div
      class="music-window-helper-r"
      @mousedown.stop="startResize(2, $event)"></div>
    <div
      class="music-window-helper-t"
      @mousedown.stop="startResize(3, $event)"></div>
    <div
      class="music-window-helper-tl"
      @mousedown.stop="startResize(4, $event)"></div>
    <div
      class="music-window-helper-tr"
      @mousedown.stop="startResize(5, $event)"></div>
    <div
      class="music-window-helper-b"
      @mousedown.stop="startResize(6, $event)"></div>
    <div
      class="music-window-helper-bl"
      @mousedown.stop="startResize(7, $event)"></div>
    <div
      class="music-window-helper-br"
      @mousedown.stop="startResize(8, $event)"></div>
  </div>
</template>
<style lang="less" scoped>
.music-window-helper {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 0;
  height: 0;
  user-select: none;
  --resize-size: 5px;
  --resize-width: calc(100vw - 10px);
  --resize-height: calc(100vh - 10px);
  z-index: 99999;
  & > div {
    position: fixed;
  }
  &-drag {
    height: 27px;
    width: 100vw;
    top: 0;
    left: 0;
  }
  &-r,
  &-l {
    height: var(--resize-height);
    width: var(--resize-size);
    top: var(--resize-size);
    cursor: ew-resize;
  }
  &-l {
    left: 0;
  }
  &-r {
    right: 0;
  }
  &-t,
  &-b {
    width: var(--resize-width);
    left: var(--resize-size);
    cursor: ns-resize;
  }
  &-t {
    top: 0;
    height: 2px;
  }
  &-b {
    height: var(--resize-size);
    bottom: 0;
  }
  &-tl,
  &-tr,
  &-bl,
  &-br {
    width: var(--resize-size);
    height: var(--resize-size);
  }
  &-tl {
    left: 0;
    top: 0;
    cursor: nwse-resize;
  }
  &-tr {
    right: 0;
    top: 0;
    cursor: nesw-resize;
  }
  &-bl {
    left: 0;
    bottom: 0;
    cursor: nesw-resize;
  }
  &-br {
    right: 0;
    bottom: 0;
    cursor: nwse-resize;
  }
}
</style>
