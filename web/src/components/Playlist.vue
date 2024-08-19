<script setup lang="ts">
import { Playlist } from '../utils/type';
import { LogoImage } from '../utils/logo';
import DailyImage from '../assets/images/calendar.png';
interface Props {
  list: Playlist[];
  loading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  list: () => [],
  loading: false
});
</script>
<template>
  <div class="music-play-list">
    <RouterLink
      :to="'/playlist/' + item.type + '/' + item.id"
      v-for="item in props.list">
      <div class="music-play-list-item">
        <img
          class="music-play-list-item-image"
          :src="item.image || LogoImage" />
        <div v-if="item.daily" class="music-play-list-item-image-daily">
          <img :src="DailyImage" />
          <span v-if="item.daily" :style="'color: ' + item.dailyColor">{{
            new Date().getDate()
          }}</span>
        </div>
        <div
          class="music-play-list-item-name text-overflow-3"
          v-html="item.name"></div>
      </div>
    </RouterLink>
    <el-skeleton class="music-play-list-item" animated :loading="loading">
      <template #template>
        <el-skeleton-item variant="image" />
        <div class="music-play-list-item-name">
          <el-skeleton-item variant="text" />
          <el-skeleton-item variant="text" style="width: 50%" />
        </div>
      </template>
    </el-skeleton>
  </div>
</template>
<style lang="less" scoped>
.music-play-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  grid-column-gap: 5px;
  grid-row-gap: 5px;
  width: 100%;
  padding-bottom: 10px;
  & > a {
    padding: 2px;
  }
  &-item {
    cursor: pointer;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    position: relative;
    color: white;
    border-radius: var(--music-border-radius);
    // outline: 2px solid rgba(85, 85, 85, 0.1);
    overflow: hidden;
    box-shadow: 0px 0px 2px 0px #9a94945c;
    text-align: center;
    &.el-skeleton {
      outline: none;
    }
    &-name {
      font-size: 20px;
      font-weight: bold;

      width: 100%;
      padding: 5px 10px;
      position: absolute;
      bottom: 0;
      left: 0;
      text-shadow: 2px 2px 5px black;
      text-align: left;
    }
    &:hover {
      .music-play-list-item-image {
        transform: scale(1.2);
        &-daily {
          transform: scale(1.2) translateX(-40%);
        }
      }
    }
    &-image,
    .el-skeleton__image {
      width: 100%;
      height: 100%;
      transition: transform 0.5s;
    }
    &-image {
      &-daily {
        display: block;
        height: 50%;
        width: 50%;
        position: absolute;
        left: 50%;
        top: 20%;
        transition: transform 0.5s;
        transform: translateX(-50%);

        & > img {
          height: 100%;
          width: 100%;
        }
        & > span {
          font-size: 30px;
          font-weight: bold;
          text-align: center;
          position: absolute;
          left: 50%;
          top: 50%;
          margin-top: 10px;
          transform: translate(-50%, -50%);
        }
      }
    }
    .el-skeleton__image {
      background: var(--el-skeleton-color) 55;
    }
  }
}
@media (max-width: 800px) {
  .music-play-list {
    grid-column-gap: 4px;
    grid-row-gap: 4px;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}
</style>
