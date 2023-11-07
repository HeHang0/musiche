<script lang="ts" setup>
import { ElMessageBox } from 'element-plus';
import { Ref, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import { WarningFilled, PictureFilled } from '@element-plus/icons-vue';

import Login from '../components/Login.vue';

import { useSettingStore } from '../stores/setting';
import { usePlayStore } from '../stores/play';
import { musicOperate } from '../utils/http';
import { musicTypeInfoAll } from '../utils/platform';
import {
  AppTheme,
  CloseType,
  MusicQuality,
  MusicType,
  ShortcutType
} from '../utils/type';
import {
  imageToDataUrl,
  scrollToElementId,
  webView2Services
} from '../utils/utils';

import LogoImageCircle from '../assets/images/logo-circle.png';
import { ThemeColor } from '../utils/color';

const { currentRoute, replace } = useRouter();
const subItems = [
  {
    name: '账号',
    id: 'account'
  },
  {
    name: '常规',
    id: 'general'
  },
  {
    name: '主题',
    id: 'theme'
  },
  {
    name: '播放',
    id: 'play'
  },
  {
    name: '快捷键',
    id: 'shortcut'
  },
  {
    name: '音质与下载',
    id: 'quality'
  },
  {
    name: '桌面歌词',
    id: 'lyric'
  },
  {
    name: '关于',
    id: 'about'
  }
];
if (webView2Services.enabled) {
  subItems.splice(3, 0, {
    name: '系统',
    id: 'system'
  });
}

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
const defaultFonts = ['宋体', '等线', '仿宋', '黑体', '楷体', '微软雅黑'];
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
    name: '默认',
    color: 'white'
  },
  {
    id: 'dark',
    name: '深色',
    color: 'black'
  },
  setting.customTheme,
  {
    id: 'red',
    name: '红',
    color: 'rgb(255,58,58)'
  }
] as AppTheme[]);
var scrollByRouter = false;
const unWatch = watch(
  () => currentRoute.value.hash,
  hash => {
    currentId.value = hash.substring(1) || 'music-header-account';
    scrollByRouter = true;
    scrollToElementId(
      currentId.value,
      false,
      !setting.pageValue.disableAnimation
    );
  }
);

function setItemsIdTitle() {
  setting.currentMusicTypeShow = false;
  if (!tableEle.value) return;
  for (let i = 0; i < tableEle.value.children.length; i++) {
    const item = tableEle.value.children[i] as HTMLTableRowElement;
    const itemTitle = item.children[0] as HTMLTableCellElement;
    itemTitle.innerText = subItems[i].name;
    itemTitle.id = 'music-header-' + subItems[i].id;
  }
  if (!document.getElementById(currentId.value))
    replace('#music-header-account');
}

const onSettingScroll = useDebounceFn(checkSettingScroll, 300);

function checkSettingScroll() {
  if (scrollByRouter) {
    scrollByRouter = false;
    return;
  }
  if (!tableEle.value) return;
  const tableTop =
    tableEle.value.parentElement?.parentElement?.getBoundingClientRect()?.top ||
    0;
  for (let i = 0; i < tableEle.value.children.length; i++) {
    const item = tableEle.value.children[i] as HTMLTableRowElement;
    const itemTitle = item?.children?.item(0);
    if (!itemTitle) continue;
    const { top, bottom } = itemTitle.getBoundingClientRect();
    if (top <= tableTop && bottom > tableTop) {
      currentId.value = itemTitle.id;
      break;
    }
  }
}

function loginSuccess() {
  ElMessageBox.close();
  setting.saveUserInfo();
}

function login(type: MusicType) {
  let title = '网易云';
  let text = '';
  switch (type) {
    case 'qq':
      title = 'QQ';
      text = '从QQ音乐获取cookie并填写';
      break;
    case 'migu':
      title = '咪咕';
      text = '打开 咪咕音乐app<br />点击顶部菜单图标,然后找到扫一扫并点击';
      break;

    default:
      title = '网易云';
      text = '使用 网易云音乐APP 扫码登录';
      break;
  }
  ElMessageBox({
    title: title + '音乐 - 登录',
    confirmButtonText: '确定',
    showCancelButton: false,
    showConfirmButton: false,
    closeOnClickModal: false,
    message: h(Login, {
      type,
      qrcode: type != 'qq',
      text,
      onLogon: loginSuccess
    })
  }).catch(() => {});
}

async function checkLocalVersion() {
  currentVersion.value = await musicOperate('/version');
}

async function checkRemoveVersion() {
  const res = await fetch('https://hehang0.github.io/musiche/version');
  remoteVersion.value = await res.text();
}

function delayExitChange() {
  console.log(
    '关闭',
    delayMinute.value * 60 + delaySecond.value,
    delayExit.value,
    delayShutdown.value
  );
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
  if (appTheme.image) {
    return `background: url(${appTheme.image}) 50% 50% / cover`;
  } else if (appTheme.color) {
    return 'background: ' + appTheme.color;
  }
  return 'background: var(--el-fill-color-light)';
}

async function setCustomTheme() {
  const image: FileSystemFileHandle[] = await (
    window as any
  ).showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: true,
    types: [
      {
        description: '图像',
        accept: {
          'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.bmp', '.webp', '.tif']
        }
      }
    ]
  });
  if (!image || image.length === 0) return;
  const file = await image[0].getFile();
  const fileUrl = URL.createObjectURL(file);
  const dataUrl = await imageToDataUrl(fileUrl, 1920);
  URL.revokeObjectURL(fileUrl);
  new ThemeColor(dataUrl, (_: string, dark?: boolean) => {
    setting.setCustomTheme({
      id: 'custom ' + (dark ? 'dark' : ''),
      image: dataUrl
    });
    if (setting.customTheme.image) {
      setting.setAppTheme(setting.customTheme);
    }
  });
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

onMounted(() => {
  setItemsIdTitle();
  checkLocalVersion();
  checkRemoveVersion();
});
onUnmounted(unWatch);
</script>
<template>
  <div class="music-setting">
    <div class="music-setting-header">
      <div class="music-setting-header-title">设置</div>
      <div class="music-setting-header-sub">
        <span
          :class="
            currentId === 'music-header-' + subItem.id
              ? 'music-setting-header-active'
              : ''
          "
          v-for="subItem in subItems"
          @click="replace('#music-header-' + subItem.id)"
          >{{ subItem.name }}</span
        >
      </div>
    </div>
    <el-scrollbar class="music-setting-body" @scroll="onSettingScroll">
      <table ref="tableEle">
        <tr>
          <td></td>
          <td class="music-setting-account">
            <div v-for="info in musicTypeInfoAll">
              <img :src="info.image" />
              <img
                v-if="setting.userInfo[info.type].image"
                :src="setting.userInfo[info.type].image" />
              <span v-if="setting.userInfo[info.type].name">
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
          <td></td>
          <td class="music-setting-general">
            <span>字体选择</span>

            <el-select
              v-model="setting.pageValue.font"
              @change="
                setting.setFont(
                  setting.pageValue.font,
                  setting.pageValue.fontBold
                )
              ">
              <el-option key="" label="默认" value="" />
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
              v-if="webView2Services.enabled"
              v-model="setting.pageValue.startup"
              @change="setting.setStartup"
              label="开机自动运行"
              size="large" />
            <el-checkbox
              v-if="webView2Services.enabled"
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
          <td></td>
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
                  <img :src="LogoImageCircle" />
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
        <tr v-if="webView2Services.enabled">
          <td></td>
          <td class="music-setting-system">
            <el-checkbox
              v-model="delayExit"
              @change="delayExitChange"
              label="开启定时关闭软件"
              size="large" />
            <span>
              剩余关闭时间
              <el-select v-model="delayMinute" @change="delayExitChange">
                <el-option
                  v-for="(_, index) in new Array(24)"
                  :key="index"
                  :label="index"
                  :value="index">
                </el-option>
              </el-select>
              小时
              <el-select v-model="delaySecond" @change="delayExitChange">
                <el-option
                  v-for="(_, index) in new Array(60)"
                  :key="index"
                  :label="index"
                  :value="index">
                </el-option>
              </el-select>
              分钟
            </span>
            <el-checkbox
              v-model="delayShutdown"
              @change="delayExitChange"
              :disabled="!delayExit"
              label="关闭软件同时关机"
              size="large" />
            <div>
              <span>关闭主面板</span>
              <el-radio-group v-model="setting.pageValue.closeType">
                <el-radio :label="CloseType.Hide">最小化到系统托盘</el-radio>
                <el-radio :label="CloseType.Exit">退出音乐和</el-radio>
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
          <td></td>
          <td class="music-setting-play">
            <el-checkbox
              v-model="setting.pageValue.playAtRun"
              @change="setting.setPlayAtRun"
              label="程序启动时自动播放"
              size="large" />
            <el-checkbox
              v-model="setting.pageValue.savePlayProgress"
              @change="setting.setSavePlayProgress"
              label="程序启动时记住上一次播放进度"
              size="large" />
            <el-checkbox
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
                <el-radio :label="false"
                  >双击播放单曲时，用当前单曲所在列表替换播放列表</el-radio
                >
                <el-radio :label="true"
                  >双击播放单曲时，仅把当前单曲添加到播放列表</el-radio
                >
              </el-radio-group>
            </div>
          </td>
        </tr>
        <tr>
          <td></td>
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
              <div v-if="webView2Services.enabled">
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
              v-if="webView2Services.enabled"
              v-model="setting.pageValue.globalShortcutUsed"
              @change="setting.setGlobalShortcutUsed"
              size="large">
              启用全局快捷键
              <span class="music-setting-subtext"> (在后台时也能响应) </span>
            </el-checkbox>
            <el-checkbox
              v-if="webView2Services.enabled"
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
          <td></td>
          <td class="music-setting-quality">
            <div class="music-setting-quality-type">
              <div class="music-setting-quality-title">在线播放音质</div>
              <el-radio-group
                class="music-setting-quality-item"
                v-model="setting.playQuality"
                @change="setting.setPlayQuality">
                <el-radio v-for="item in musicQualities" :label="item.quality">
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
                <el-radio v-for="item in musicQualities" :label="item.quality">
                  {{ item.title }}
                </el-radio>
              </el-radio-group>
            </div>
          </td>
        </tr>
        <tr>
          <td></td>
          <td class="music-setting-lyric">
            <div class="music-setting-lyric-item">
              <el-checkbox
                v-model="play.desktopLyricShow"
                @change="play.showDesktopLyric"
                size="large">
                启用桌面歌词
              </el-checkbox>
              <el-checkbox
                v-if="webView2Services.enabled"
                v-model="setting.pageValue.lyric.topmost"
                @change="setting.setLyricOptions"
                size="large">
                启用歌词总在最前
              </el-checkbox>
            </div>
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title">字体</span>
              <el-select
                v-model="setting.pageValue.lyric.fontFamily"
                @change="setting.setLyricOptions">
                <el-option key="" label="默认" value="" />
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
              <span class="music-setting-lyric-item-title">字号</span>
              <el-select
                class="short"
                v-model="setting.pageValue.lyric.fontSize"
                @change="setting.setLyricOptions">
                <el-option
                  v-for="(_item, index) in new Array(50)"
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
            <div class="music-setting-lyric-item">
              <span class="music-setting-lyric-item-title">配色方案</span>
              <el-select
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
                :style="'--fix-color:' + setting.pageValue.lyric.fontColor"
                >字体色</span
              >
              <span
                class="music-setting-lyric-item-fix-color"
                :style="'--fix-color:' + setting.pageValue.lyric.effectColor"
                >描边色</span
              >
            </div>
          </td>
        </tr>
        <tr>
          <td></td>
          <td class="music-setting-about">
            <span> 当前版本 {{ currentVersion }} </span>
            <span
              v-if="
                webView2Services.enabled && currentVersion != remoteVersion
              ">
              最新版本 {{ remoteVersion }}
            </span>
            <div
              class="music-setting-about-download"
              v-if="!webView2Services.enabled">
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.exe"
                target="_blank">
                <img src="https://support.microsoft.com/apple-touch-icon.png" />
                <p>PC版</p>
              </a>
              <a
                class="music-setting-about-card"
                href="https://hehang0.github.io/musiche/Musiche.net6.exe"
                target="_blank">
                <img
                  src="https://dotnet.microsoft.com/icons/brand-dotnet.png" />
                <p>PC版(NET6)</p>
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
  &-header {
    height: 90px;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-bottom: 1px solid var(--music-border-color);
    margin: 0 var(--music-page-padding-horizontal);
    &-title {
      font-size: 24px;
    }
    &-sub {
      padding-bottom: 5px;
      margin-bottom: 5px;
      span {
        opacity: 0.6;
        cursor: pointer;
      }
      span + span {
        margin-left: 30px;
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
    height: calc(100% - 90px);
    padding: 0 var(--music-page-padding-horizontal);
    table {
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
          :deep(.el-checkbox__inner) {
            border-radius: var(--music-border-radius);
            outline: 2px solid white;
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
      & > span {
        font-weight: bold;
        margin-right: 32px;
      }
      .el-checkbox {
        margin-left: 32px;
      }
    }
  }
  &-lyric {
    &-item {
      display: flex;
      align-items: center;
      margin: 5px 0;
      &-title {
        font-weight: bold;
        margin-right: 20px;
      }
      .el-select.short {
        width: 80px;
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
    }
  }
  &-about {
    display: flex;
    flex-direction: column;
    &-download {
      display: flex;
    }
    &-card {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 20px 30px 0 0;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
      img {
        width: 50px;
        height: 50px;
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
</style>
