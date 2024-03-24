<script lang="ts" setup>
import { ElMessageBox } from 'element-plus';
import { Ref, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { WarningFilled, PictureFilled } from '@element-plus/icons-vue';

import Login from '../components/Login.vue';

import { useSettingStore } from '../stores/setting';
import { usePlayStore } from '../stores/play';
import { httpAddress, musicOperate } from '../utils/http';
import { musicTypeInfo, musicTypeInfoAll } from '../utils/platform';
import {
  AppTheme,
  CloseType,
  MusicQuality,
  MusicType,
  RemoteClient,
  ShortcutType
} from '../utils/type';
import {
  getImageFile,
  imageToDataUrl,
  isInStandaloneMode,
  isMobile,
  isSafari,
  isWindows,
  scrollToElementId
} from '../utils/utils';

import { LogoCircleImage } from '../utils/logo';
import { ThemeColorManager } from '../utils/color';
import DroidImage from '../assets/images/droid.svg';
import AppleImage from '../components/apple.vue';
import { getServiceWorkerRegistration } from '../sw/register';
import { isIOS } from '@vueuse/core';

const { currentRoute, replace, options } = useRouter();

const shortcutItems: { name: string; operate: ShortcutType }[] = [
  {
    name: '播放/暂停',
    operate: 'play'
  },
  {
    name: '上一首',
    operate: 'last'
  },
  {
    name: '下一首',
    operate: 'next'
  },
  {
    name: '音量加',
    operate: 'plus'
  },
  {
    name: '音量减',
    operate: 'minus'
  },
  {
    name: '喜欢歌曲',
    operate: 'love'
  }
];

const musicQualities: {
  quality: MusicQuality;
  title: string;
}[] = [
  {
    quality: 'ZQ',
    title: '至臻无损'
  },
  {
    quality: 'SQ',
    title: '无损'
  },
  {
    quality: 'HQ',
    title: '高清'
  },
  {
    quality: 'PQ',
    title: '标准'
  }
];
const lyricColors: Record<
  string,
  {
    name: string;
    effect: string;
  }
> = {
  '#ffb0b0': {
    name: '红',
    effect: '#cb7474'
  },
  '#e0c3ff': {
    name: '晖',
    effect: '#8e76c2'
  },
  '#fcbede': {
    name: '粉',
    effect: '#be80a0'
  },
  '#acd3e5': {
    name: '蓝',
    effect: '#5495b4'
  },
  '#dcf6c3': {
    name: '绿',
    effect: '#67905c'
  },
  '#ded8f8': {
    name: '紫',
    effect: '#998dc9'
  },
  '#fadda7': {
    name: '黄',
    effect: '#fadcd5'
  },
  '#bfbfbf': {
    name: '灰',
    effect: '#8b8b8b'
  }
};

const currentId = ref(
  currentRoute.value.hash.substring(1) || 'music-header-account'
);
const tableEle: Ref<HTMLTableElement | null> = ref(null);
const defaultFonts = isWindows
  ? ['宋体', '等线', '仿宋', '黑体', '楷体', '微软雅黑']
  : [
      'Noto Sans SC',
      'Times New Roman',
      'Georgia',
      'Arial',
      'Helvetica',
      'Arial Black',
      'Verdana',
      'Trebuchet MS',
      'Geneva',
      'Courier New',
      'Courier',
      'Impact',
      'Comic Sans MS',
      'Brush Script MT',
      'Lucida Handwriting'
    ];
const setting = useSettingStore();
const play = usePlayStore();
const currentVersion = ref('');
const remoteVersion = ref('');
const delayMinute = ref(0);
const delaySecond = ref(0);
const delayExit = ref(false);
const delayShutdown = ref(false);
const themes = ref([
  {
    id: '',
    name: '亮色',
    color: 'white'
  },
  {
    id: 'dark',
    name: '深色',
    color: '#13131a'
  },
  setting.customTheme,
  {
    id: 'dark pure',
    name: '暗色',
    color: 'black'
  },
  {
    id: 'red',
    name: '红',
    color: 'rgb(255,58,58)'
  }
] as AppTheme[]);
let scrolling = false;
function setScrolling() {
  scrolling = true;
  setTimeout(() => {
    scrolling = false;
  }, 1000);
}
const unWatch = watch(
  () => currentRoute.value.hash,
  hash => {
    currentId.value = hash.substring(1) || 'music-header-account';
    setScrolling();
    scrollToElementId(currentId.value, false, false);
  }
);
const installPromptShow = ref(isIOS || isMobile);
let installPrompt: any = null;
function onBeforeInstallPrompt(event: any) {
  installPrompt = event;
  installPromptShow.value = true;
  event.preventDefault();
}
if (isInStandaloneMode && !isIOS && 'BeforeInstallPromptEvent' in window)
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt, true);
function installPWA() {
  if (isInStandaloneMode) return;
  if (isIOS || isMobile) {
    ElMessageBox({
      title: '添加到主屏幕',
      confirmButtonText: '完成',
      showCancelButton: false,
      message: h('div', {}, [
        h('p', {}, `点击浏览器 [${isIOS ? '分享' : '更多'}] 按钮`),
        h('p', {}, '然后 [添加到主屏幕]')
      ])
    });
  } else {
    installPrompt && installPrompt.prompt();
  }
}

function forceRefreshPage() {
  let historyBase = options.history.base || '';
  const substringLength = historyBase ? historyBase.length + 2 : 1;
  if (historyBase && !historyBase.startsWith('/'))
    historyBase = '/' + historyBase;
  getServiceWorkerRegistration()?.update();
  location.href =
    location.origin +
    historyBase +
    '?redirect=' +
    location.pathname.substring(substringLength) +
    '&_=' +
    new Date().valueOf();
}

function setItemsIdTitle() {
  setting.currentMusicTypeShow = false;
  if (!document.getElementById(currentId.value))
    replace('#music-header-account');
}

function loginSuccess() {
  ElMessageBox.close();
  setting.saveUserInfo();
}

function logout(type: MusicType) {
  ElMessageBox({
    title: '注销',
    confirmButtonText: '确定',
    message: `确实要注销 [${musicTypeInfo[type].name}] 吗？`
  })
    .then(() => {
      setting.userInfo[type].cookie = '';
      setting.userInfo[type].id = '';
      setting.userInfo[type].name = '';
      setting.userInfo[type].image = '';
      setting.saveUserInfo(true);
    })
    .catch(() => {});
}

function login(type: MusicType) {
  const info = musicTypeInfo[type];
  let title = info.name;
  let text = info.loginTips;
  ElMessageBox({
    title: title + ' - 登录',
    confirmButtonText: '确定',
    showCancelButton: false,
    showConfirmButton: false,
    closeOnClickModal: false,
    message: h(Login, {
      type,
      qrcode: true, //type != 'qq',
      text,
      onLogon: loginSuccess
    })
  }).catch(() => {});
}

async function checkLocalVersion() {
  const version = await musicOperate('/version');
  if (/[\d]+\.[\d]+\.[\d]+/.test(version)) currentVersion.value = version;
}

async function checkRemoveVersion() {
  const res = await fetch(
    'https://hehang0.github.io/musiche/version?_=' + new Date().valueOf()
  );
  remoteVersion.value = await res.text();
}

function delayExitChange() {
  if (delayShutdown.value && !delayExit.value) {
    delayShutdown.value = false;
  }
  musicOperate(
    '/delayExit?shutdown=' + (delayShutdown.value ? 'true' : ''),
    (delayExit.value
      ? delayMinute.value * 60 + delaySecond.value
      : 0
    ).toString()
  );
}

function getCardBackground(appTheme: AppTheme) {
  if (appTheme.objectURL) {
    return `background: url(${appTheme.objectURL}) 50% 50% / cover`;
  } else if (appTheme.color) {
    return 'background: ' + appTheme.color;
  }
  return 'background: var(--el-fill-color-light)';
}

async function setCustomTheme() {
  let fileUrl: string | null = null;
  if (setting.config.remote && isSafari && !isMobile) {
    const res = await musicOperate('/file/select/image');
    if (res && res.data)
      fileUrl = `//${httpAddress}/file?path=${encodeURIComponent(res.data)}`;
  } else {
    const imageFile: File | null = await getImageFile();
    if (!imageFile) return;
    fileUrl = URL.createObjectURL(imageFile);
  }
  if (!fileUrl) return;
  const dataUrl = await imageToDataUrl(fileUrl, 1920, 1920);
  URL.revokeObjectURL(fileUrl);
  const c = await ThemeColorManager.getThemeColor(dataUrl);
  setting.setCustomTheme({
    id: 'custom ' + (c?.dark ? 'dark' : ''),
    image: dataUrl
  });
  if (setting.customTheme.image) {
    setting.setAppTheme(setting.customTheme);
  }
}

function onRemoteClientChanged(client: RemoteClient) {
  musicOperate(
    '/remote/client',
    JSON.stringify({
      address: client.address,
      channel: client.channel
    }),
    {
      'Content-Type': 'application/json'
    }
  );
}

function setAppTheme(theme: AppTheme) {
  if (
    theme.id?.startsWith('custom') &&
    (!theme.image || setting.appTheme.id === setting.customTheme.id)
  ) {
    setCustomTheme();
    return;
  }
  if (theme.id === setting.appTheme.id) return;
  setting.setAppTheme(theme);
}
var observer = null;
const viewElements: {
  id: string;
  visible: boolean;
}[] = [];
function onObserve(
  entries: IntersectionObserverEntry[],
  _observer: IntersectionObserver
) {
  entries.forEach(m => {
    if (!m.target) return;
    const ele = viewElements.find(v => v.id === m.target.children[0].id);
    if (ele) {
      ele.visible = m.intersectionRect.top > 0;
    } else {
      viewElements.push({
        id: m.target.children[0].id,
        visible: m.intersectionRect.top > 0
      });
    }
  });
  if (scrolling) {
    scrolling = false;
    return;
  }
  const visibleElement = viewElements.find(m => m.visible);
  if (visibleElement) currentId.value = visibleElement.id;
  scrollToElementId('title-' + currentId.value, false, false);
}
function startObserve() {
  if (!tableEle.value) return;
  observer = new IntersectionObserver(onObserve, {
    threshold: 0
  });
  for (let i = 0; i < tableEle.value.children.length; i++) {
    try {
      const child = tableEle.value.children[i];
      observer.observe(child);
    } catch (error) {}
  }
}

onMounted(() => {
  setItemsIdTitle();
  checkLocalVersion();
  checkRemoveVersion();
  startObserve();
  setScrolling();
  scrollToElementId(currentId.value, false, false);
  scrollToElementId('title-' + currentId.value, false, false);
});
onUnmounted(unWatch);
</script>
<template>
  <div class="music-setting">
    <div class="music-setting-header">
      <div class="music-setting-header-title">设置</div>
      <div class="music-setting-header-sub">
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-account'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-account')">
          账号
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-general'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-general')">
          常规
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-theme'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-theme')">
          主题
        </span>
        <span
          v-if="isWindows && setting.config.remote"
          id="title-music-header-"
          :class="
            currentId === 'music-header-system'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-system')">
          系统
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-play'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-play')">
          播放
        </span>
        <span
          v-if="!isMobile"
          id="title-music-header-"
          :class="
            currentId === 'music-header-shortcut'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-shortcut')">
          快捷键
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-quality'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-quality')">
          音质与下载
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-lyric'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-lyric')">
          桌面歌词
        </span>
        <span
          id="title-music-header-"
          :class="
            currentId === 'music-header-about'
              ? 'music-setting-header-active'
              : ''
          "
          @click="replace('#music-header-about')">
          关于
        </span>
      </div>
    </div>
    <el-scrollbar class="music-setting-body">
      <table ref="tableEle">
        <tr>
          <td id="music-header-account">账号</td>
          <td class="music-setting-account">
            <div v-for="info in musicTypeInfoAll">
              <img :src="info.image" />
              <img
                v-if="setting.userInfo[info.type].image"
                :src="setting.userInfo[info.type].image" />
              <span
                v-if="setting.userInfo[info.type].name"
                @click="logout(info.type)">
                {{ setting.userInfo[info.type].name }}
              </span>
              <span
                v-if="!setting.userInfo[info.type].id"
                @click="login(info.type)">
                登录
              </span>
            </div>
          </td>
        </tr>
        <tr>
          <td id="music-header-general">常规</td>
          <td class="music-setting-general">
            <span>字体选择</span>

            <el-select
              placeholder="默认"
              v-model="setting.pageValue.font"
              @change="
                setting.setFont(
                  setting.pageValue.font,
                  setting.pageValue.fontBold
                )
              ">
              <el-option key="default" label="默认" value="" />
              <el-option key="auto" label="系统" value="auto" />
              <el-option
                v-for="item in setting.fonts || defaultFonts"
                :key="item"
                :label="item"
                :title="item"
                :value="item">
                <div
                  class="text-overflow-1"
                  style="width: 120px"
                  :style="{ fontFamily: `${item}` }">
                  {{ item }}
                </div>
              </el-option>
            </el-select>
            <el-checkbox
              v-model="setting.pageValue.fontBold"
              v-show="setting.pageValue.font"
              @change="
                setting.setFont(
                  setting.pageValue.font,
                  setting.pageValue.fontBold
                )
              "
              label="字体加粗"
              size="large" />
            <el-checkbox
              v-if="isWindows && setting.config.remote"
              v-model="setting.pageValue.startup"
              @change="setting.setStartup"
              label="开机自动运行"
              size="large" />
            <el-checkbox
              v-if="setting.config.gpu"
              v-model="setting.pageValue.gpuAcceleration"
              @change="setting.setGpuAcceleration()"
              size="large">
              使用硬件加速模式
              <span class="music-setting-subtext">（如果可用）</span>
            </el-checkbox>
            <el-checkbox
              v-model="setting.pageValue.disableAnimation"
              @change="setting.setDisableAnimation"
              size="large">
              禁用动画效果
              <span class="music-setting-subtext">
                (减少资源占用，提升性能)
              </span>
            </el-checkbox>
          </td>
        </tr>
        <tr>
          <td id="music-header-theme">主题</td>
          <td class="music-setting-theme">
            <span>
              <el-switch
                v-model="setting.autoAppTheme"
                @change="setting.autoAppThemeChanged()"></el-switch>
              跟随系统
            </span>
            <div
              class="music-setting-theme-container"
              v-if="!setting.autoAppTheme">
              <div
                class="music-setting-theme-card"
                v-for="theme in themes"
                @click="setAppTheme(theme)">
                <div
                  class="music-setting-theme-card-color"
                  :style="getCardBackground(theme)">
                  <el-icon v-if="!theme.color && !theme.image"
                    ><PictureFilled
                  /></el-icon>
                  <img :src="LogoCircleImage" />
                  <el-checkbox
                    v-if="setting.appTheme.id == theme.id"
                    checked></el-checkbox>
                </div>
                <span class="music-setting-theme-card-name">{{
                  theme.name
                }}</span>
              </div>
            </div>
          </td>
        </tr>
        <tr v-if="isWindows && setting.config.remote">
          <td id="music-header-system">系统</td>
          <td class="music-setting-system">
            <el-checkbox
              v-model="delayExit"
              @change="delayExitChange"
              label="开启定时关闭软件"
              size="large" />
            <span>
              <span>剩余关闭时间</span>
              <span>
                <el-select
                  placeholder="默认"
                  v-model="delayMinute"
                  @change="delayExitChange">
                  <el-option
                    v-for="(_, index) in new Array(24)"
                    :key="index"
                    :label="index"
                    :value="index">
                  </el-option>
                </el-select>
                小时
              </span>
              <span>
                <el-select
                  placeholder="默认"
                  v-model="delaySecond"
                  @change="delayExitChange">
                  <el-option
                    v-for="(_, index) in new Array(60)"
                    :key="index"
                    :label="index"
                    :value="index">
                  </el-option>
                </el-select>
                分钟
              </span>
            </span>
            <el-checkbox
              v-if="!isMobile"
              v-model="delayShutdown"
              @change="delayExitChange"
              :disabled="!delayExit"
              label="关闭软件同时关机"
              size="large" />
            <div class="music-setting-system-center" v-if="!isMobile">
              <span>关闭主面板</span>
              <el-radio-group v-model="setting.pageValue.closeType">
                <el-radio :value="CloseType.Hide">最小化到系统托盘</el-radio>
                <el-radio :value="CloseType.Exit">退出音乐和</el-radio>
              </el-radio-group>
              <el-checkbox
                v-model="setting.pageValue.closeTypeNoRemind"
                @change="setting.setCloseTypeNoRemind"
                size="large">
                不再提醒
              </el-checkbox>
            </div>
          </td>
        </tr>
        <tr>
          <td id="music-header-play">播放</td>
          <td class="music-setting-play">
            <el-checkbox
              v-if="setting.config.file"
              v-model="setting.pageValue.playAtRun"
              @change="setting.setPlayAtRun"
              label="程序启动时自动播放"
              size="large" />
            <el-checkbox
              v-if="setting.config.file"
              v-model="setting.pageValue.savePlayProgress"
              @change="setting.setSavePlayProgress"
              label="程序启动时记住上一次播放进度"
              size="large" />
            <el-checkbox
              v-if="setting.config.file"
              v-model="setting.pageValue.fadeIn"
              @change="setting.setFadeIn()"
              label="开启音乐淡入"
              size="large" />
            <div>
              <span>播放列表</span>
              <el-radio-group
                class="radio-group-vertical"
                v-model="setting.pageValue.onlyAddMusicListAtDbClick"
                @change="setting.setOnlyAddMusicListAtDbClick">
                <el-radio :value="false"
                  >双击播放单曲时，用当前单曲所在列表替换播放列表</el-radio
                >
                <el-radio :value="true"
                  >双击播放单曲时，仅把当前单曲添加到播放列表</el-radio
                >
              </el-radio-group>
            </div>
            <div
              class="music-setting-play-remote-clients"
              v-if="setting.config.client && setting.remoteClients.length > 0">
              <span>多机互联</span>
              <div>
                <div
                  class="music-setting-play-remote-clients-item"
                  v-for="client in setting.remoteClients">
                  <div>
                    <span class="name">
                      {{ client.name }}
                      <span class="local" v-if="client.local">本机</span>
                    </span>
                    <span class="origin">{{ client.origin }}</span>
                  </div>
                  <el-select
                    v-model="client.channel"
                    size="small"
                    placeholder="禁用"
                    @change="onRemoteClientChanged(client)">
                    <el-option label="禁用" :value="-1" />
                    <el-option label="立体声" :value="0" />
                    <el-option label="左声道" :value="1" />
                    <el-option label="右声道" :value="2" />
                  </el-select>
                </div>
              </div>
            </div>
          </td>
        </tr>
        <tr v-if="!isMobile">
          <td id="music-header-shortcut">快捷键</td>
          <td class="music-setting-shortcut">
            <div>
              <div>
                <div>功能说明</div>
                <div v-for="item in shortcutItems">{{ item.name }}</div>
              </div>
              <div>
                <div>快捷键</div>
                <div v-for="item in shortcutItems">
                  <el-input
                    :value="setting.pageValue.shortcutText[item.operate]"
                    @keyup="setting.registerShortCut(item.operate, $event)" />
                </div>
              </div>
              <div v-if="isWindows && setting.config.remote">
                <div>全局快捷键</div>
                <div v-for="item in shortcutItems">
                  <el-input
                    :value="setting.pageValue.globalShortcutText[item.operate]"
                    @keyup="setting.setGlobalShortCut(item.operate, $event)" />
                  <el-tooltip
                    v-if="setting.pageValue.globalShortcut[item.operate].status"
                    :content="
                      setting.pageValue.globalShortcut[item.operate].status
                    ">
                    <WarningFilled class="music-setting-warning" />
                  </el-tooltip>
                </div>
              </div>
            </div>
            <el-checkbox
              v-if="isWindows && setting.config.remote"
              v-model="setting.pageValue.globalShortcutUsed"
              @change="setting.setGlobalShortcutUsed"
              size="large">
              启用全局快捷键
              <span class="music-setting-subtext"> (在后台时也能响应) </span>
            </el-checkbox>
            <el-checkbox
              v-if="isWindows && setting.config.remote"
              v-model="setting.pageValue.systemMediaShortcutUsed"
              @change="setting.setSystemMediaShortcutUsed"
              size="large">
              使用系统媒体快捷键
              <span class="music-setting-subtext">
                (播放/暂停、上一首、下一首、停止)
              </span>
            </el-checkbox>
          </td>
        </tr>
        <tr>
          <td id="music-header-quality">音质与下载</td>
          <td class="music-setting-quality">
            <div class="music-setting-quality-type">
              <div class="music-setting-quality-title">在线播放音质</div>
              <el-radio-group
                class="music-setting-quality-item"
                v-model="setting.playQuality"
                @change="setting.setPlayQuality">
                <el-radio v-for="item in musicQualities" :value="item.quality">
                  {{ item.title }}
                </el-radio>
              </el-radio-group>
            </div>
            <div class="music-setting-quality-type">
              <div class="music-setting-quality-title">本地下载音质</div>
              <el-radio-group
                class="music-setting-quality-item"
                v-model="setting.downloadQuality"
                @change="setting.setDownloadQuality">
                <el-radio v-for="item in musicQualities" :value="item.quality">
                  {{ item.title }}
                </el-radio>
              </el-radio-group>
            </div>
          </td>
        </tr>
        <tr>
          <td id="music-header-lyric">桌面歌词</td>
          <td class="music-setting-lyric">
            <div class="music-setting-lyric-item">
              <el-checkbox
                v-model="play.desktopLyricShow"
                @change="play.showDesktopLyric(play.desktopLyricShow)"
                size="large">
                启用桌面歌词
              </el-checkbox>
              <el-checkbox
                v-if="isWindows && setting.config.remote"
                v-model="setting.pageValue.lyric.topmost"
                @change="setting.setLyricOptions"
                size="large">
                启用歌词总在最前
              </el-checkbox>
            </div>
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title"
                >字<span style="opacity: 0">占位</span>体</span
              >
              <el-select
                placeholder="默认"
                v-model="setting.pageValue.lyric.fontFamily"
                @change="setting.setLyricOptions">
                <el-option key="default" label="默认" value="" />
                <el-option
                  v-for="item in setting.fonts || defaultFonts"
                  :key="item"
                  :label="item"
                  :title="item"
                  :value="item">
                  <div
                    class="text-overflow-1"
                    style="width: 120px"
                    :style="{ fontFamily: `${item}` }">
                    {{ item }}
                  </div>
                </el-option>
              </el-select>
            </div>
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title"
                >字<span style="opacity: 0">占位</span>号</span
              >
              <el-select
                placeholder="默认"
                class="short"
                v-model="setting.pageValue.lyric.fontSize"
                @change="setting.setLyricOptions">
                <el-option
                  v-for="(_item, index) in new Array(53)"
                  :key="index"
                  :label="index + 20"
                  :value="index + 20">
                  {{ index + 20 }}
                </el-option>
              </el-select>
            </div>
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title">字体加粗</span>
              <el-checkbox
                v-model="setting.pageValue.lyric.fontBold"
                @change="setting.setLyricOptions"
                size="large">
              </el-checkbox>
            </div>
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title">字体描边</span>
              <el-checkbox
                v-model="setting.pageValue.lyric.effect"
                @change="setting.setLyricOptions"
                size="large">
              </el-checkbox>
            </div>
            <div
              class="music-setting-lyric-item music-setting-lyric-item-portrait-top">
              <span class="music-setting-lyric-item-title">配色方案</span>
              <div class="music-setting-lyric-item-color">
                <el-select
                  placeholder="默认"
                  class="short"
                  v-model="setting.pageValue.lyric.fontColor"
                  @change="
                    setting.setLyricEffectColor(
                      lyricColors[setting.pageValue.lyric.fontColor].effect
                    )
                  ">
                  <el-option
                    v-for="key in Object.keys(lyricColors)"
                    :key="key"
                    :label="lyricColors[key].name"
                    :value="key">
                    {{ lyricColors[key].name }}
                  </el-option>
                </el-select>
                <span
                  class="music-setting-lyric-item-fix-color"
                  :style="'--fix-color:' + setting.pageValue.lyric.fontColor">
                  字体色
                </span>
                <span
                  class="music-setting-lyric-item-fix-color"
                  :style="'--fix-color:' + setting.pageValue.lyric.effectColor">
                  描边色
                </span>
              </div>
            </div>
            <div
              class="music-setting-lyric-item music-setting-lyric-item-portrait-top">
              <span class="music-setting-lyric-item-title"
                >预<span style="opacity: 0">占位</span>览</span
              >
              <div
                class="music-setting-lyric-item-preview"
                :style="{
                  fontSize: setting.pageValue.lyric.fontSize + 'px',
                  fontFamily: setting.pageValue.lyric.fontFamily,
                  color: setting.pageValue.lyric.fontColor,
                  textShadow: setting.pageValue.lyric.effect
                    ? '0 0 1px ' + setting.pageValue.lyric.effectColor
                    : 'none',
                  fontWeight: setting.pageValue.lyric.fontBold
                    ? 'bold'
                    : 'normal'
                }">
                音乐和
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td id="music-header-about">关于</td>
          <td class="music-setting-about">
            <span> 当前版本 {{ currentVersion }} </span>
            <span
              v-if="
                (!setting.config.remote || setting.config.file) &&
                currentVersion != remoteVersion
              ">
              最新版本 {{ remoteVersion }}
            </span>
            <span
              v-if="!setting.config.remote && currentVersion != remoteVersion"
              class="music-setting-about-update"
              @click="forceRefreshPage">
              点击更新
            </span>
            <div class="music-setting-about-download">
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.exe"
                target="_blank">
                <div class="logo-app logo-app-microsoft">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <p>PC版</p>
              </a>
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.net6.exe"
                target="_blank">
                <div class="logo-app" style="--logo-app-color: #512bd4">
                  .NET
                </div>
                <p>PC版(NET6)</p>
              </a>
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.dmg"
                target="_blank">
                <div
                  class="logo-app"
                  style="
                    --logo-app-color: var(--music-footer-background);
                    color: white;
                  ">
                  <el-icon size="44"><AppleImage /></el-icon>
                </div>
                <p>MacOS版</p>
              </a>
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.apk"
                target="_blank">
                <div
                  class="logo-app"
                  style="--logo-app-color: var(--music-footer-background)">
                  <img :src="DroidImage" />
                </div>
                <p>Android版</p>
              </a>
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.ipa"
                target="_blank">
                <div
                  class="logo-app"
                  style="
                    --logo-app-color: var(--music-footer-background);
                    color: var(--music-text-color);
                  ">
                  <el-icon size="44"><AppleImage /></el-icon>
                </div>
                <p>IOS版</p>
              </a>
              <a
                v-if="
                  !isInStandaloneMode &&
                  installPromptShow &&
                  !setting.config.remote
                "
                class="music-setting-about-card"
                @click.stop="installPWA">
                <div
                  class="logo-app"
                  style="--logo-app-color: var(--music-primary-color)">
                  PWA
                </div>
                <p>WebAPP</p>
              </a>
            </div>
          </td>
        </tr>
      </table>
    </el-scrollbar>
  </div>
</template>
<style lang="less" scoped>
.music-setting {
  height: 100%;
  display: flex;
  flex-direction: column;
  &-header {
    font-weight: bold;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    // border-bottom: 1px solid var(--music-border-color);
    margin: 0 var(--music-page-padding-horizontal);
    &-title {
      font-size: 24px;
    }
    &-sub {
      // display: flex;
      // flex-wrap: wrap;
      // column-gap: 30px;
      // row-gap: 5px;
      max-width: 100%;
      overflow-x: auto;
      padding-bottom: 5px;
      margin-bottom: 5px;
      border-bottom: 1px solid var(--music-border-color);
      width: fit-content;
      white-space: nowrap;
      &::-webkit-scrollbar {
        height: 0;
        width: 0;
      }
      & > span + span {
        margin-left: 30px;
      }
      span {
        opacity: 0.6;
        cursor: pointer;
      }
    }
    span&-active {
      opacity: 1;
      &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -5px;
        transform: translateX(-50%);
        width: 80%;
        height: 3px;
        border-radius: 3px;
        background-color: var(--music-primary-color);
      }
    }
  }
  &-warning {
    position: absolute;
    right: 20px;
    top: 8px;
    width: 16px;
    height: 16px;
    color: red;
    cursor: pointer;
  }
  &-body {
    flex: 1;
    padding: 0 var(--music-page-padding-horizontal);
    table {
      display: block;
      width: 100%;
      border-spacing: 0;
      & > tr {
        vertical-align: top;
        padding: 20px 0;
        & > td {
          padding: 40px 0 0 0;
        }
        & > td:first-child {
          width: 130px;
          font-weight: bold;
        }
      }
      & > tr:last-child {
        & > td {
          padding-bottom: 40px;
        }
      }
    }
  }
  &-subtext {
    opacity: 0.6;
  }
  &-account {
    & > div + div {
      margin-top: 5px;
    }
    & > div {
      width: 100%;
      height: 34px;
      display: flex;
      align-items: center;
      & > img {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin-left: 2px;
        box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
      }
      span {
        cursor: pointer;
        margin-left: 10px;
        color: var(--music-primary-color);
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
  &-general {
    display: flex;
    flex-direction: column;
    .el-select {
      width: 140px;
      margin-top: 10px;
    }
    & > span:first-child {
      font-weight: bold;
    }
  }
  &-theme {
    display: flex;
    flex-direction: column;
    &-container {
      display: flex;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    &-card {
      width: 150px;
      height: 130px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      border-radius: var(--music-border-radius);
      margin: 0 10px 10px 0;
      &:hover {
        background: var(--music-button-info-border-color);
      }
      &-color {
        border-radius: var(--music-border-radius);
        border: 1px solid var(--music-button-info-border-color);
        flex: 1;
        background-size: cover;
        & > * {
          position: absolute;
        }
        img {
          width: 30px;
          height: 30px;
          left: 10px;
          top: 10px;
        }
        .el-checkbox {
          right: 5px;
          bottom: 5px;
          height: unset;
          border: 2px solid white;
          border-radius: 50%;
          :deep(.el-checkbox__inner) {
            border-radius: var(--music-border-radius);
            &::after {
              left: 3px;
            }
            // outline: 2px solid white;
          }
        }
        .el-icon {
          font-size: 35px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
        }
      }
      &-name {
        margin: 5px 10px;
      }
    }
  }
  &-system {
    display: flex;
    flex-direction: column;
    & > div {
      display: flex;
      align-items: center;
      & > span {
        font-weight: bold;
        margin-right: 32px;
      }
      .el-checkbox {
        margin-left: 32px;
      }
    }
    @media (max-width: 800px) {
      & > span {
        display: flex;
        flex-direction: column;
      }
    }
    .el-select {
      width: 120px;
      margin: 0 6px;
    }
  }
  &-play {
    display: flex;
    flex-direction: column;
    & > div {
      display: flex;
      flex-direction: column;
      width: 100%;
      & > .radio-group-vertical {
        width: 100%;
        overflow-x: auto;
        &::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      }
      & > span {
        font-weight: bold;
        margin-right: 32px;
      }
      .el-checkbox {
        margin-left: 32px;
      }
    }
    &-remote-clients {
      & > span {
        margin-bottom: 5px;
      }
      &-item {
        display: flex;
        align-items: center;
        gap: 20px;
        & + & {
          margin-top: 10px;
        }
        & > div:first-child {
          display: flex;
          align-items: flex-start;
          flex-direction: column;
          justify-content: space-between;
          .local {
            border: 1px solid;
            border-radius: 4px;
            font-size: 0.5rem;
            padding: 0 3px;
            color: var(--music-primary-color);
            vertical-align: text-top;
            margin-left: 2px;
          }
          .origin {
            opacity: 0.7;
            font-size: 0.8rem;
          }
        }
        .el-select {
          width: 100px;
        }
      }
    }
  }
  &-lyric {
    &-item {
      display: flex;
      align-items: center;
      margin-top: 15px;
      &:first-child {
        margin-top: 0;
      }
      &-title {
        font-weight: bold;
        margin-right: 20px;
      }
      &-color {
        display: flex;
      }
      &-fix-color {
        margin-left: 20px;
        display: flex;
        align-items: center;
        &::before {
          content: '';
          display: inline-block;
          width: 15px;
          height: 15px;
          margin-right: 5px;
          background-color: var(--fix-color);
        }
      }
      &-preview {
        border-radius: var(--music-border-radius);
        border: 1px solid var(--music-button-info-border-color);
        flex: 1;
        height: 100px;
        text-align: center;
        line-height: 100px;
        background-color: var(--music-side-background);
        letter-spacing: 6px;
      }
      .el-select {
        width: 140px;
        &.short {
          width: 80px;
          height: 28px;
          :deep(.el-select__wrapper) {
            height: 28px;
            min-height: 28px;
          }
        }
      }
      .el-checkbox {
        height: 24px;
      }
      :deep(.el-input__inner) {
        height: 26px;
      }
    }
  }
  &-about {
    display: flex;
    flex-direction: column;
    &-download {
      display: flex;
      margin-top: 30px;
      gap: 20px;
      flex-wrap: wrap;
    }
    &-update {
      cursor: pointer;
      color: -webkit-link;
    }
    &-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      color: inherit; //-webkit-link;
      &:hover {
        p {
          text-decoration: underline;
        }
      }
      .logo-app,
      img {
        width: 50px;
        height: 50px;
        border-radius: var(--music-border-radius);
      }
      .logo-app {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 19px;
        color: white;
        font-weight: bold;
        font-family: 'Arial';
        background-color: var(--logo-app-color);
        &-microsoft {
          flex-wrap: wrap;
          justify-content: space-around;
          align-items: stretch;
          & > div {
            width: calc(50% - 2px);
            height: calc(50% - 2.5px);
          }
          & > div:nth-child(1) {
            border-radius: var(--music-border-radius) 0 0 0;
            background-color: #f24f1c;
          }
          & > div:nth-child(2) {
            border-radius: 0 var(--music-border-radius) 0 0;
            background-color: #80bb00;
          }
          & > div:nth-child(3) {
            border-radius: 0 0 0 var(--music-border-radius);
            background-color: #00a5ef;
          }
          & > div:nth-child(4) {
            border-radius: 0 0 var(--music-border-radius) 0;
            background-color: #ffba00;
          }
        }
      }
      p {
        margin-top: 10px;
      }
    }
  }
  &-shortcut {
    display: flex;
    flex-direction: column;
    & > div {
      display: flex;
      & > div {
        &:first-child {
          & > div {
            width: 150px;
          }
        }
        &:nth-child(2),
        &:last-child {
          width: 210px;
        }
        & > div {
          height: 50px;
        }
        .el-input {
          padding-right: 40px;
          :deep(.el-input__wrapper) {
            border-radius: var(--music-infinity);
          }
        }

        // display: flex;

        // &:first-child {
        //   font-weight: bold;
        //   height: 40px;
        // }
        // & > *:first-child {
        //   width: 150px;
        //   height: 50px;
        // }
        // & > *:nth-child(2),
        // & > *:last-child {
        //   width: 210px;
        //   height: 50px;
        // }
      }
    }
  }
  &-quality {
    display: flex;
    flex-direction: column;
    &-type {
      display: flex;
    }
    &-type + &-type {
      margin-top: 20px;
    }
    &-title {
      font-weight: bold;
      width: 100px;
    }
    &-item {
      flex: 1;
      align-items: baseline;
      .el-radio {
        height: 26px;
        margin-right: 0;
        margin-left: 20px;
        :deep(.el-radio__inner) {
          box-shadow: 0 0 3px var(--music-background);
        }
      }
    }
  }
}
@media (max-width: 800px) {
  .music-setting {
    &-body {
      table > tr {
        display: flex;
        flex-direction: column;
        & > td:first-child {
          padding: 0;
        }
        & > td:last-child {
          padding-top: 20px;
        }
      }
    }
    &-lyric {
      &-item {
        &-portrait-top {
          align-items: baseline;
        }
        &-fix-color {
          margin-left: 0;
          margin-top: 5px;
        }
        &-color {
          flex-direction: column;
        }
      }
    }
  }
}
</style>
