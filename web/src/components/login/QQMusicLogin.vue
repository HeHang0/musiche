<script lang="ts" setup>
import { ref } from 'vue';
import * as api from '../../utils/api/api';
import { useSettingStore } from '../../stores/setting';
import { parseCookie } from '../../utils/utils';
import { useDebounceFn } from '@vueuse/core';
import { MusicType } from '../../utils/type';

const setting = useSettingStore();

const emit = defineEmits({
  logon: () => {}
});
const cookie = ref('');
const cookieChange = useDebounceFn(setUserInfo, 500);

async function setUserInfo(cookie: string) {
  var cookieInfo = parseCookie(cookie);
  if (!cookieInfo.uin) return;
  const userInfo = await api.userInfo(MusicType.QQMusic, cookieInfo);
  if (userInfo && userInfo.id) {
    setting.userInfo.qq.id = userInfo.id;
    setting.userInfo.qq.name = userInfo.name;
    setting.userInfo.qq.image = userInfo.image;
    setting.userInfo.qq.cookie = cookieInfo;
    emit('logon');
  }
}
</script>
<template>
  <div class="music-qq-login">
    <p>从QQ音乐获取cookie并填写</p>
    <p>
      <el-input v-model="cookie" clearable @input="cookieChange"></el-input>
    </p>
  </div>
</template>
<style lang="less" scoped>
.music-qq-login {
  width: 100%;
  height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  p {
    margin: 20px 0;
  }
}
</style>
