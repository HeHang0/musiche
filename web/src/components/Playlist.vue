<script setup lang="ts">
import { Playlist } from '../utils/type';
import DefaultImage from '../assets/images/default.png';
interface Props {
  list: Playlist[];
}
const props = withDefaults(defineProps<Props>(), {
  list: () => []
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
          :src="item.image || DefaultImage" />
        <div class="music-play-list-item-name">{{ item.name }}</div>
      </div>
    </RouterLink>
  </div>
</template>
<style lang="less" scoped>
.music-play-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  padding-right: 5px;
  grid-column-gap: 5px;
  grid-row-gap: 10px;
  width: 100%;
  height: 100%;
  padding-bottom: 10px;
  &-item {
    cursor: pointer;
    width: 180px;
    height: 180px;
    position: relative;
    color: white;
    border-radius: var(--music-border-radio);
    outline: 2px solid rgba(85, 85, 85, 0.1);
    overflow: hidden;
    &-name {
      font-size: 20px;
      font-weight: bold;

      width: 180px;
      //   height: 55px;
      padding: 5px 10px;
      position: absolute;
      bottom: 0;
      left: 0;
      text-shadow: 2px 2px 5px black;
    }
    &:hover {
      .music-play-list-item-image {
        transform: scale(1.2);
      }
    }
    &-image {
      width: 180px;
      height: 180px;
      transition: transform 0.5s;
    }
  }
}
</style>
