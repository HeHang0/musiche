<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import * as api from '../../utils/api/api';
import { MusicType } from '../../utils/type';
import { useSettingStore } from '../../stores/setting';
import { parseCookie } from '../../utils/utils';

const setting = useSettingStore();

const qrCodeImage = ref<string>('');
const loading = ref(true);
const authorizing = ref(false);

var uniKeyTimeout: any = null;
var qrCodeTimeout: any = null;

const emit = defineEmits({
  logon: () => {}
});
let loaded = false;
async function checkQRCode(key: string) {
  if (!loaded) return;
  const data = await api.qrCodeState(MusicType.MiguMusic, key);
  const state = data?.state || 0;
  if (state == 2000) {
    var cookieInfo = parseCookie(data!.cookie);
    const userInfo = await api.userInfo(MusicType.MiguMusic, cookieInfo);
    if (userInfo && userInfo.id) {
      setting.userInfo.migu.id = userInfo.id;
      setting.userInfo.migu.name = userInfo.name;
      setting.userInfo.migu.image = userInfo.image;
      setting.userInfo.migu.cookie = cookieInfo;
      emit('logon');
    } else {
      setQrCodeImage();
    }
  } else if (state == 4074) {
    qrCodeTimeout = setTimeout(() => {
      checkQRCode(key);
    }, 1000);
  } else {
    // setQrCodeImage();
  }
}

async function setQrCodeImage() {
  if (!loaded) return;
  qrCodeImage.value = '';
  authorizing.value = false;
  clearTimeout(uniKeyTimeout);
  clearTimeout(qrCodeTimeout);
  loading.value = true;
  const uniKey = await api.qrCodeKey(MusicType.MiguMusic);
  if (!uniKey || !uniKey.key || !uniKey.url) {
    uniKeyTimeout = setTimeout(setQrCodeImage, 1000);
  } else {
    qrCodeImage.value = uniKey.url;
    loading.value = false;
    qrCodeImage.value && checkQRCode(uniKey.key);
  }
}
onMounted(() => {
  loaded = true;
  setQrCodeImage();
});
onUnmounted(() => {
  loaded = false;
  clearTimeout(uniKeyTimeout);
  clearTimeout(qrCodeTimeout);
});
</script>
<template>
  <div class="music-migu-login">
    <p>扫码登录</p>
    <img
      class="music-migu-login-image"
      v-if="qrCodeImage && !loading"
      :src="qrCodeImage" />
    <el-skeleton class="music-migu-login-image" animated :loading="loading">
      <template #template>
        <el-skeleton-item variant="image" />
      </template>
    </el-skeleton>
    <p>打开 咪咕音乐app</p>
    <p>点击顶部菜单图标,然后找到扫一扫并点击</p>
  </div>
</template>
<style lang="less" scoped>
.music-migu-login {
  width: 100%;
  height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  a {
    color: var(--music-primary-color);
  }
  &-image {
    width: 200px;
    height: 200px;
    margin: 10px 0;
    .el-skeleton__item {
      height: 100%;
    }
  }
}
</style>
