<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Close } from '@element-plus/icons-vue';

const props = withDefaults(
  defineProps<{
    content?: string;
    image?: string;
    self?: boolean;
    variant?: 'room' | 'particle';
  }>(),
  {
    content: '',
    image: '',
    self: false,
    variant: 'room'
  }
);

const emit = defineEmits<{
  mediaLoad: [];
}>();

const previewClosed = ref(false);

const link = computed(() => {
  const value = props.content.trim();
  if (!/^https?:\/\/\S+$/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return {
      href: url.href,
      host: url.host.replace(/^www\./i, '')
    };
  } catch {
    return null;
  }
});

watch(
  () => props.content,
  () => {
    previewClosed.value = false;
  }
);
</script>

<template>
  <div
    class="room-chat-content"
    :class="[`is-${variant}`, { 'is-self': self }]">
    <template v-if="link">
      <div v-if="!previewClosed" class="room-chat-link-card">
        <div class="room-chat-link-head">
          <a
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            :title="link.href">
            <span class="room-chat-link-mark">↗</span>
            <span>{{ link.host }}</span>
          </a>
          <el-button
            class="room-chat-link-close"
            :icon="Close"
            text
            circle
            title="关闭链接预览"
            aria-label="关闭链接预览"
            @click="previewClosed = true" />
        </div>
        <iframe
          :src="link.href"
          :title="`${link.host} 链接预览`"
          loading="lazy"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          allow="
            autoplay 'none';
            camera 'none';
            microphone 'none';
            geolocation 'none';
          "
          referrerpolicy="no-referrer"
          @load="emit('mediaLoad')" />
        <a
          class="room-chat-link-address"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.href">
          {{ link.href }}
        </a>
      </div>
      <div v-else class="room-chat-link-closed">
        <a
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.href">
          {{ link.host }}
        </a>
        <button type="button" @click="previewClosed = false">重新预览</button>
      </div>
    </template>
    <span v-else-if="content" class="room-chat-text">{{ content }}</span>
    <img
      v-if="image"
      class="room-chat-image"
      :src="image"
      alt="聊天图片"
      @load="emit('mediaLoad')" />
  </div>
</template>

<style scoped lang="less">
.room-chat-content {
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.room-chat-content.is-self {
  align-items: flex-end;
}
.room-chat-text {
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  background: var(--music-button-info-border-color);
  line-height: 1.45;
  overflow-wrap: anywhere;
  cursor: text;
  user-select: text;
}
.is-room .room-chat-text {
  min-height: var(--music-room-chat-avatar-size, 34px);
  display: inline-flex;
  align-items: center;
}
.is-self .room-chat-text {
  color: #fff;
  background: var(--music-button-primary-background);
}
.is-particle .room-chat-text {
  margin-top: 5px;
  border-radius: 3px 12px 12px 12px;
  color: rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.065);
  font-size: 12px;
  line-height: 1.55;
}
.is-particle.is-self .room-chat-text {
  border-radius: 12px 3px 12px 12px;
  color: #07131b;
  background: linear-gradient(135deg, #98e4ef, #72c6e7);
}
.room-chat-image {
  display: block;
  width: auto;
  max-width: 200px;
  max-height: 200px;
  border-radius: var(--music-border-radius, 10px);
  object-fit: contain;
}
.room-chat-link-card,
.room-chat-link-closed {
  width: min(280px, 100%);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 13px;
  background: rgba(12, 16, 23, 0.76);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(14px);
}
.room-chat-link-head {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 7px 0 10px;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.055);
  font-size: 11px;
}
.room-chat-link-head a {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  text-decoration: none;
}
.room-chat-link-head a span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-chat-link-mark {
  color: var(--music-primary-color);
}
.room-chat-link-close.el-button {
  --el-button-size: 22px;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.07);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}
.room-chat-link-close.el-button :deep(.el-icon) {
  margin: 0;
  font-size: 13px;
  transform-origin: 50% 50%;
  transition: transform 0.2s ease;
}
.room-chat-link-close.el-button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.room-chat-link-close.el-button:hover :deep(.el-icon) {
  transform: rotate(90deg);
}
.room-chat-link-card iframe {
  display: block;
  width: 100%;
  height: 158px;
  border: 0;
  background: rgba(0, 0, 0, 0.28);
}
.room-chat-link-address {
  display: block;
  overflow: hidden;
  padding: 7px 10px 8px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
  line-height: 1.2;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-chat-link-address:hover {
  color: var(--music-primary-color);
}
.room-chat-link-closed {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 6px 11px;
  font-size: 11px;
}
.room-chat-link-closed a {
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-chat-link-closed button {
  flex: 0 0 auto;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.68);
  background: rgba(255, 255, 255, 0.06);
  font-size: 10px;
  cursor: pointer;
}
</style>
