import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw
} from 'vue-router';
import Recommend from '../views/recommend.vue';

const routers: RouteRecordRaw[] = [
  {
    path: '/',
    redirect(to) {
      const redirectParam = to.query.redirect;
      if (typeof redirectParam === 'string' && redirectParam) {
        delete to.query.redirect;
        return redirectParam;
      }
      return '/recommend';
    }
  },
  {
    path: '/recommend/:type?',
    name: '发现音乐',
    meta: { key: 'recommend', icon: '荐' },
    component: Recommend
  },
  {
    path: '/yours/:type?',
    name: '我的音乐',
    meta: { key: 'yours', icon: '我' },
    component: Recommend
  },
  {
    path: '/ranking/:type?/:ranking?',
    name: '音乐榜单',
    meta: { key: 'ranking', icon: '顶' },
    component: () => import(`../views/ranking.vue`)
  },
  {
    path: '/search/:type/:keywords',
    name: '搜索',
    meta: { key: 'search', show: false },
    component: () => import(`../views/search.vue`)
  },
  {
    path: '/playlist/:type/:id',
    name: '歌单详情',
    meta: { key: 'playlist', show: false },
    component: () => import(`../views/playlist.vue`)
  },
  {
    path: '/album/:type/:id',
    name: '专辑详情',
    meta: { key: 'album', show: false },
    component: () => import(`../views/playlist.vue`)
  },
  {
    path: '/lover',
    name: '我喜欢的音乐',
    meta: { key: 'lover', show: false, localShow: true },
    component: () => import(`../views/playlist.vue`)
  },
  {
    path: '/recent',
    name: '最近播放',
    meta: { key: 'recent', show: false, localShow: true },
    component: () => import(`../views/playlist.vue`)
  },
  {
    path: '/created/:id',
    name: '创建的歌单',
    meta: { key: 'created', show: false, localShow: true },
    component: () => import(`../views/playlist.vue`)
  },
  {
    path: '/setting/:item?',
    name: '设置',
    meta: { key: 'setting', show: false },
    component: () => import(`../views/setting.vue`)
  }
];
routers.push({ path: '/:catchAll(.*)', redirect: '/recommend' });
const router = createRouter({
  history: createWebHistory(
    localStorage.getItem('musiche-router-prefix') || undefined
  ),
  routes: routers
});

export default router;
