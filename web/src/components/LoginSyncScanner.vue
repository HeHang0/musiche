<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import jsQR from 'jsqr';

const emit = defineEmits({
  sync: (_text: string) => true
});

const videoEle = ref<HTMLVideoElement | null>(null);
const message = ref('正在打开摄像头');
let stream: MediaStream | null = null;
let stopped = false;
let scanTimer: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null = null;

function stopCamera() {
  stopped = true;
  if (scanTimer != null) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  canvas?.remove();
  canvas = null;
  canvasContext = null;
}

function scan() {
  const video = videoEle.value;
  if (!video || !canvas || !canvasContext || stopped) return;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    scanTimer = window.setTimeout(scan, 1000);
    return;
  }
  try {
    canvas.width = width;
    canvas.height = height;
    canvasContext.drawImage(video, 0, 0, width, height);
    const imageData = canvasContext.getImageData(0, 0, width, height);
    const qrCode = jsQR(imageData.data, width, height, {
      inversionAttempts: 'attemptBoth'
    });
    if (qrCode?.data) {
      stopCamera();
      emit('sync', qrCode.data);
      return;
    }
  } catch {}
  scanTimer = window.setTimeout(scan, 1000);
}

function getCameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return '当前页面不是安全上下文，摄像头需要 HTTPS 或 localhost';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return '当前浏览器不支持摄像头访问';
  }
  const errorName = error instanceof DOMException ? error.name : '';
  switch (errorName) {
    case 'NotAllowedError':
      return '摄像头权限被拒绝';
    case 'NotFoundError':
      return '没有找到可用摄像头';
    case 'NotReadableError':
      return '摄像头被其他应用占用';
    case 'OverconstrainedError':
      return '后置摄像头不可用';
    default:
      return '摄像头打开失败';
  }
}

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    if (!videoEle.value) return;
    videoEle.value.srcObject = stream;
    await videoEle.value.play();
    canvas = document.createElement('canvas');
    canvasContext = canvas.getContext('2d', { willReadFrequently: true });
    if (!canvasContext) {
      message.value = '扫码画布初始化失败';
      return;
    }
    message.value = '将电脑端二维码放入取景框';
    scan();
  } catch (error) {
    message.value = getCameraErrorMessage(error);
  }
});

onUnmounted(stopCamera);
</script>

<template>
  <div class="music-login-sync-scanner">
    <video ref="videoEle" playsinline muted></video>
    <p>{{ message }}</p>
  </div>
</template>

<style lang="less" scoped>
.music-login-sync-scanner {
  width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  video {
    width: 260px;
    height: 260px;
    object-fit: cover;
    border-radius: var(--music-border-radius);
    background: #000;
  }
  p {
    margin: 12px 0 0;
    opacity: 0.7;
    text-align: center;
  }
}
</style>
