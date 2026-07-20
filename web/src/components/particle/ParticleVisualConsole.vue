<script setup lang="ts">
const open = defineModel<boolean>({ required: true });
const props = withDefaults(
  defineProps<{
    embedded?: boolean;
    visible?: boolean;
  }>(),
  {
    embedded: false,
    visible: true
  }
);
</script>

<template>
  <div
    v-if="open && props.visible"
    class="particle-console-mask"
    @pointerdown.stop
    @click="open = false" />
  <div
    class="particle-console-wrap particle-stage-floating-ui"
    :class="{
      'is-embedded': props.embedded,
      'is-hidden': !props.visible
    }"
    @pointerdown.stop
    @wheel.stop>
    <button
      class="particle-console-fab"
      type="button"
      title="视觉控制台"
      @click="open = !open">
      ☷
    </button>
    <slot v-if="open" />
  </div>
</template>

<style lang="less" scoped>
.particle-console-mask {
  position: absolute;
  z-index: 7;
  inset: 0;
  background: transparent;
  cursor: default;
}
.particle-console-wrap {
  position: absolute;
  z-index: 8;
  right: 24px;
  bottom: 24px;
  opacity: 1;
  transition: opacity 0.38s ease;
}
.particle-console-wrap.is-embedded {
  bottom: 100px;
}
.particle-console-wrap.is-hidden {
  opacity: 0;
  pointer-events: none;
}
.particle-console-fab {
  width: 37px;
  height: 37px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(240, 246, 255, 0.75);
  background: rgba(7, 10, 17, 0.42);
  backdrop-filter: blur(12px);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  &:hover {
    color: #8de7db;
    border-color: rgba(109, 226, 209, 0.7);
    background: rgba(16, 31, 43, 0.72);
  }
}
@media (max-width: 560px) {
  .particle-console-wrap {
    right: 12px;
    bottom: 12px;
  }
}
</style>
