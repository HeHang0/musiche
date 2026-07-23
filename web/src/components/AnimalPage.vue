<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useSettingStore } from '../stores/setting';

const AnimalCard = defineAsyncComponent(() =>
  import('animal-island-ui-vue').then(module => module.Card)
);
const AnimalDivider = defineAsyncComponent(() =>
  import('animal-island-ui-vue').then(module => module.Divider)
);

interface Props {
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: ''
});
const setting = useSettingStore();
const active = computed(() => setting.appTheme.id === 'animal-island');
</script>

<template>
  <template v-if="!active">
    <slot />
  </template>
  <div v-else class="music-animal-page">
    <AnimalCard class="music-animal-page-card" color="default">
      <div v-if="props.title" class="music-animal-page-title">
        {{ props.title }}
      </div>
      <AnimalDivider v-if="props.title" class="music-animal-page-divider" />
      <div class="music-animal-page-content">
        <slot />
      </div>
    </AnimalCard>
  </div>
</template>

<style lang="less" scoped>
.music-animal-page {
  height: 100%;
  overflow: hidden;
  padding: 16px var(--music-page-padding-horizontal) 18px;
  background: transparent;

  &-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 18px;
    border: 3px solid #d7c7a4;
    border-radius: 30px;
    background:
      linear-gradient(
        180deg,
        rgba(255, 253, 246, 0.9),
        rgba(247, 243, 223, 0.84)
      ),
      var(--animal-bg-color);
    backdrop-filter: blur(6px);
    box-shadow:
      inset 0 1px rgba(255, 255, 255, 0.7),
      0 10px 0 rgba(189, 174, 160, 0.42),
      0 18px 40px rgba(83, 61, 36, 0.13);

    &:hover {
      transform: none;
    }
  }

  &-title {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-height: 38px;
    padding: 0 20px;
    border: 2px solid #d4c9b4;
    border-radius: 999px;
    background: #fffaf0;
    color: #725d42;
    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow: 0 3px #e2d7c3;
  }

  &-divider {
    margin: 12px 0 14px;
  }

  &-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;

    :deep(> *) {
      height: 100%;
    }
  }
}

@media (max-width: 800px) {
  .music-animal-page {
    padding: 8px;

    &-card {
      padding: 10px;
      border-radius: 22px;
    }
  }
}
</style>
