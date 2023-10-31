<script lang="ts" setup>
import { ElCheckbox, ElMessageBox, ElRadio, ElRadioGroup } from 'element-plus';
import { useSettingStore } from '../stores/setting';
import { h, ref } from 'vue';
import { CloseType } from '../utils/type';

const setting = useSettingStore();
const closeType = ref(setting.pageValue.closeType);
let closeTypeNoRemind: boolean = setting.pageValue.closeTypeNoRemind;
var closing = false;
async function close() {
  await setting.setCloseType(closeType.value);
  await setting.setCloseTypeNoRemind(closeTypeNoRemind);
  if (setting.pageValue.closeType == CloseType.Exit) {
    setting.exit();
  } else {
    setting.hide();
  }
}
function prepareClose() {
  if (setting.pageValue.closeTypeNoRemind) {
    close();
    return;
  }
  if (closing) return;
  closeTypeNoRemind = setting.pageValue.closeTypeNoRemind;
  closing = true;
  ElMessageBox({
    title: '关闭提示',
    confirmButtonText: '确定',
    showCancelButton: false,
    closeOnClickModal: false,
    customStyle: {
      paddingBottom: '30px'
    },
    message: h(
      'div',
      {
        class: 'layout-vertical layout-center'
      },
      [
        h(
          ElRadioGroup,
          {
            // 必须传ref才可以，如果用modelValue编译器会提示类型错误。浏览器会提示类型错误
            'model-value': closeType,
            onChange: (val: boolean | string | number) => {
              closeType.value = val as CloseType;
              console.log('值变了', closeType.value);
            },
            class: 'radio-group-vertical'
          },
          () => [
            h(ElRadio, { label: CloseType.Hide }, () => '最小化到系统托盘'),
            h(ElRadio, { label: CloseType.Exit }, () => '退出音乐和')
          ]
        ),
        h(
          ElCheckbox,
          {
            checked: closeTypeNoRemind,
            onChange: (val: string | number | boolean) => {
              closeTypeNoRemind = Boolean(val);
              console.log('值变了', setting.pageValue.closeTypeNoRemind);
            },
            style: {
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: '-110px',
              zIndex: 100
            }
          },
          () => '不再提醒'
        )
      ]
    )
  })
    .then(close)
    .finally(() => {
      closing = false;
    });
}
</script>
<template>
  <div class="music-window-controls">
    <span class="music-icon" @click="setting.minimize"> 小 </span>
    <span
      v-if="setting.maximized"
      class="music-icon"
      @click="setting.maximize(false)">
      原
    </span>
    <span v-else class="music-icon" @click="setting.maximize(true)"> 大 </span>
    <span class="music-icon" @click="prepareClose"> 关 </span>
  </div>
</template>
<style lang="less">
.music-window-controls {
  display: flex;
  align-items: center;
  padding-left: 10px;
  margin-left: 10px;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 1px;
    height: 50%;
    background-color: var(--music-border-color);
    border-radius: 1px;
  }
  .music-icon {
    cursor: pointer;
    opacity: 0.8;
    font-size: 12px;
    font-weight: bold;
    &:hover {
      opacity: 1;
    }
  }
  .music-icon + .music-icon {
    margin-left: 10px;
  }
}
</style>
