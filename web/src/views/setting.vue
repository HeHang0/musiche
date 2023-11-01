<script lang="ts" setup>
import { Ref, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import { WarningFilled } from '@element-plus/icons-vue';
import { scrollToElementId, webView2Services } from '../utils/utils';
import { useSettingStore } from '../stores/setting';
import { CloseType, MusicType, ShortcutType } from '../utils/type';
import { ElMessageBox } from 'element-plus';
import Login from '../components/Login.vue';
import { musicTypeInfoAll } from '../utils/platform';

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
  subItems.splice(2, 0, {
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

const currentId = ref(
  currentRoute.value.hash.substring(1) || 'music-header-account'
);
const tableEle: Ref<HTMLTableElement | null> = ref(null);
const defaultFonts = ['宋体', '等线', '仿宋', '黑体', '楷体', '微软雅黑'];
const setting = useSettingStore();
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

onMounted(setItemsIdTitle);
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
              @change="setting.setGpuAcceleration"
              size="large">
              开启GPU加速
              <span class="music-setting-subtext">
                (若软件黑屏，尝试关闭GPU加速功能解决)
              </span>
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
        <tr v-if="webView2Services.enabled">
          <td></td>
          <td class="music-setting-system">
            <el-checkbox
              v-model="setting.pageValue.timeClose"
              @change="setting.setStartup"
              label="开启定时关闭软件"
              size="large" />
            <el-checkbox
              v-model="setting.pageValue.timeCloseAndShutdown"
              @change="setting.setStartup"
              :disabled="!setting.pageValue.timeClose"
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
              @change="setting.setFadeIn"
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
          <td>我是账号</td>
        </tr>
        <tr>
          <td></td>
          <td>我是账号</td>
        </tr>
        <tr>
          <td></td>
          <td>我是账号</td>
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
            border-radius: calc((var(--music-infinity) * 1px));
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
}
</style>
