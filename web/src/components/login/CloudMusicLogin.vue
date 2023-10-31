<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import QRCode from 'qrcode';
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

function qrcodeGenerate(text: string): Promise<string> {
  return new Promise((resolve, _reject) => {
    QRCode.toDataURL(text, (_err, url) => {
      resolve(url);
    });
  });
}

async function checkQRCode(key: string) {
  if (!loaded) return;
  const data = await api.qrCodeState(MusicType.CloudMusic, key);
  const state = data?.state || 0;
  if (state == 803) {
    var cookieInfo = parseCookie(data!.cookie);
    const userInfo = await api.userInfo(MusicType.CloudMusic, cookieInfo);
    if (userInfo && userInfo.id) {
      setting.userInfo.cloud.id = userInfo.id;
      setting.userInfo.cloud.name = userInfo.name;
      setting.userInfo.cloud.image = userInfo.image;
      setting.userInfo.cloud.cookie = {
        __csrf: cookieInfo['__csrf'] || '',
        MUSIC_U: cookieInfo['MUSIC_U'] || '',
        uid: userInfo.id.toString()
      };
      emit('logon');
    } else {
      setQrCodeImage();
    }
  } else if (state == 801 || state == 802) {
    if (state == 802) authorizing.value = true;
    qrCodeTimeout = setTimeout(() => {
      checkQRCode(key);
    }, 1000);
  } else {
    setQrCodeImage();
  }
}

async function setQrCodeImage() {
  if (!loaded) return;
  qrCodeImage.value = '';
  authorizing.value = false;
  clearTimeout(uniKeyTimeout);
  clearTimeout(qrCodeTimeout);
  loading.value = true;
  const uniKey = await api.qrCodeKey(MusicType.CloudMusic);
  if (!uniKey) {
    uniKeyTimeout = setTimeout(setQrCodeImage, 1000);
  } else {
    qrCodeImage.value = await qrcodeGenerate(
      'http://music.163.com/login?codekey=' + uniKey.key
    );
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
  <div class="music-cloud-login">
    <p>扫码登录</p>
    <img
      class="music-cloud-login-image"
      v-if="qrCodeImage && !loading"
      :src="qrCodeImage" />
    <div class="music-cloud-login-authorizing" v-show="authorizing">
      <span>扫描成功</span>
      <span>请在手机上确认登录</span>
    </div>
    <el-skeleton class="music-cloud-login-image" animated :loading="loading">
      <template #template>
        <el-skeleton-item variant="image" />
      </template>
    </el-skeleton>
    <p>使用 网易云音乐APP 扫码登录</p>
  </div>
</template>
<style lang="less" scoped>
.music-cloud-login {
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
  &-authorizing {
    width: 200px;
    height: 200px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: #ffffffcc;
    & > span:first-child {
      font-size: 20px;
    }
  }
}
</style>
