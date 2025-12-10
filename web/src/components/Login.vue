<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import * as api from '../utils/api/api';
import { MusicType } from '../utils/type';
import { useSettingStore } from '../stores/setting';
import { useDebounceFn } from '@vueuse/core';

interface Props {
  type: MusicType;
  qrcode: boolean;
  text?: string;
  title?: string;
}
const props = withDefaults(defineProps<Props>(), {
  type: 'cloud',
  qrcode: true
});

const setting = useSettingStore();

const qrCodeImage = ref<string>('');
const loading = ref(false);
const authorizing = ref(false);

var uniKeyTimeout: any = null;
var qrCodeTimeout: any = null;

const emit = defineEmits({
  logon: () => {}
});
let loaded = false;
const cookie = ref('');
const cookieChange = useDebounceFn(checkQRCode, 500);

async function checkQRCode(key: string) {
  if (!loaded) return;
  const data = await api.loginStatus(props.type, key);
  switch (data.status) {
    case 'success':
      setting.userInfo[props.type].id = data!.user!.id;
      setting.userInfo[props.type].name = data!.user!.name;
      setting.userInfo[props.type].image = data!.user!.image;
      setting.userInfo[props.type].cookie = data!.user!.cookie;
      emit('logon');
      return;
    case 'authorizing':
      authorizing.value = true;
      qrCodeTimeout = setTimeout(checkQRCode.bind(null, key), 1000);
      return;
    case 'waiting':
      qrCodeTimeout = setTimeout(checkQRCode.bind(null, key), 1000);
      return;
  }
  console.log('login error', data);
  props.qrcode && setTimeout(setQrCodeImage, 1000);
}

async function setQrCodeImage() {
  if (!loaded) return;
  qrCodeImage.value = '';
  authorizing.value = false;
  clearTimeout(uniKeyTimeout);
  clearTimeout(qrCodeTimeout);
  if (!props.qrcode) {
    return;
  }
  loading.value = true;
  const uniKey = await api.qrCodeKey(props.type);
  console.log('login key', uniKey);
  if (!uniKey) {
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
  <div class="music-cloud-login">
    <p>{{ props.title || '扫码登录' }}</p>
    <img
      class="music-cloud-login-image"
      v-if="qrCodeImage && !loading"
      :src="qrCodeImage" />
    <p v-if="!props.qrcode">
      <el-input v-model="cookie" clearable @input="cookieChange"></el-input>
    </p>
    <div class="music-cloud-login-authorizing" v-show="authorizing">
      <span>扫描成功</span>
      <span>请在手机上确认登录</span>
    </div>
    <el-skeleton class="music-cloud-login-image" animated :loading="loading">
      <template #template>
        <el-skeleton-item variant="image" />
      </template>
    </el-skeleton>
    <p v-if="props.text" v-html="props.text"></p>
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
  .el-input {
    margin-top: 40px;
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
