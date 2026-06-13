<script setup lang="ts">
import { PlaylistSearchItem } from '../utils/type';
import { LogoImage, LogoCircleImage } from '../utils/logo';

interface Props {
  list: PlaylistSearchItem[];
  loading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  list: () => [],
  loading: false
});

function formatCount(count: number) {
  if (!count) return '0';
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return count.toString();
}
</script>
<template>
  <div class="music-search-playlist-list">
    <div
      class="music-search-playlist-list-header"
      v-show="loading || props.list.length > 0">
      <div class="music-search-playlist-list-header-cover">标题</div>
      <div class="music-search-playlist-list-header-title"></div>
      <div class="music-search-playlist-list-header-creator">创建人</div>
      <div class="music-search-playlist-list-header-count">歌曲数量</div>
      <div class="music-search-playlist-list-header-count">收听数量</div>
    </div>
    <el-empty
      v-show="!loading && props.list.length === 0"
      :image="LogoCircleImage"
      description="空空如也" />
    <div
      v-for="item in props.list"
      :key="item.type + item.id"
      class="music-search-playlist-list-item">
      <RouterLink
        class="music-search-playlist-list-item-cover"
        :to="'/playlist/' + item.type + '/' + item.id">
        <img :src="item.image || LogoImage" />
      </RouterLink>
      <div class="music-search-playlist-list-item-title">
        <RouterLink
          class="music-search-playlist-list-item-name text-overflow-1"
          :title="item.name"
          :to="'/playlist/' + item.type + '/' + item.id">
          <span v-html="item.highlightName || item.name"></span>
        </RouterLink>
        <div
          class="music-search-playlist-list-item-description text-overflow-1"
          :title="item.description">
          {{ item.description }}
        </div>
      </div>
      <RouterLink
        class="music-search-playlist-list-item-creator text-overflow-1"
        :to="
          '/search/' +
          item.type +
          '/playlist/' +
          encodeURIComponent(item.creator)
        ">
        {{ item.creator }}
      </RouterLink>
      <div class="music-search-playlist-list-item-count">
        {{ formatCount(item.trackCount) }}首
      </div>
      <div class="music-search-playlist-list-item-count">
        {{ formatCount(item.playCount) }}
      </div>
    </div>
    <el-skeleton animated :loading="loading">
      <template #template>
        <div class="music-search-playlist-list-item">
          <div class="music-search-playlist-list-item-cover">
            <el-skeleton-item variant="image" />
          </div>
          <div class="music-search-playlist-list-item-title">
            <el-skeleton-item variant="text" />
            <el-skeleton-item variant="text" style="width: 50%" />
          </div>
          <div class="music-search-playlist-list-item-creator">
            <el-skeleton-item variant="text" />
          </div>
          <div class="music-search-playlist-list-item-count">
            <el-skeleton-item variant="text" />
          </div>
          <div class="music-search-playlist-list-item-count">
            <el-skeleton-item variant="text" />
          </div>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>
<style lang="less" scoped>
.music-search-playlist-list {
  padding: 0 10px 10px 10px;
  &-header,
  &-item {
    display: flex;
    align-items: center;
    & + & {
      margin-top: 10px;
    }
  }
  &-header {
    border-bottom: 1px solid var(--music-side-divider-color);
    font-size: 13px;
    opacity: 0.6;
    margin-bottom: 8px;
    cursor: default;
    & > div {
      display: flex;
      align-items: center;
      height: 50px;
    }
    &-cover {
      width: 70px;
      justify-content: center;
    }
    &-title {
      flex: 1;
    }
    &-count {
      width: 110px;
      justify-content: center;
    }
    &-creator {
      width: 130px;
      justify-content: center;
    }
  }
  &-item {
    min-height: 66px;
    font-size: 13px;
    &:hover {
      background-color: var(--music-background-hover);
      border-radius: var(--music-border-radius);
    }
    &-cover {
      width: 70px;
      display: flex;
      justify-content: center;
      align-items: center;
      img,
      .el-skeleton__image {
        width: 50px;
        height: 50px;
        border-radius: var(--music-border-radius);
      }
    }
    &-title {
      flex: 1;
      width: 0;
    }
    &-name {
      display: inline-block;
      max-width: 100%;
      font-size: 16px;
      color: var(--music-text-color);
    }
    &-description {
      max-width: 100%;
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
    &-count {
      width: 110px;
      display: flex;
      justify-content: center;
      color: var(--el-text-color-placeholder);
    }
    &-creator {
      width: 130px;
      display: flex;
      justify-content: center;
      color: var(--el-text-color-placeholder);
    }
    &-name,
    &-creator {
      cursor: pointer;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}
.el-skeleton {
  .el-skeleton__text {
    width: 60%;
  }
  .el-skeleton__image {
    border-radius: var(--music-border-radius);
  }
}
@media (max-width: 800px) {
  .music-search-playlist-list {
    &-header-count,
    &-item-count,
    &-header-creator,
    &-item-creator {
      width: 70px;
    }
    &-header-count:nth-last-child(2),
    &-item-count:nth-last-child(2) {
      display: none;
    }
  }
}
</style>
