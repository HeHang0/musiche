import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'default-passive-events';

import App from './App.vue';
import router from './router';

import 'element-plus/theme-chalk/dark/css-vars.css';
import 'element-plus/theme-chalk/el-message-box.css';
import 'element-plus/theme-chalk/el-radio-group.css';
import 'element-plus/theme-chalk/el-radio.css';
import 'element-plus/theme-chalk/el-checkbox.css';
import './style/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
