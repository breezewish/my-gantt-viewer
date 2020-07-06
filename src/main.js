import Vue from 'vue';
import Buefy from 'buefy';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';
import VueClipboard from 'vue-clipboard2';
import vueHeadful from 'vue-headful';
import store from '@/store';
import { OctoClientPlugin } from '@/plugins/octoclient';
import App from '@/App.vue';
import IndexPage from '@/pages/IndexPage.vue';
import ViewPage from '@/pages/ViewPage.vue';
import ManageLocalPanelsPage from '@/pages/ManageLocalPanelsPage.vue';
import ViewLocalPanelPage from '@/pages/ViewLocalPanelPage.vue';

Vue.use(Buefy);
Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(OctoClientPlugin);
Vue.use(VueClipboard);
Vue.component('vue-headful', vueHeadful);

Vue.config.productionTip = false;

const router = new VueRouter({
  mode: 'history',
  routes: [
    {
      name: 'index',
      path: '/',
      component: IndexPage,
    },
    {
      name: 'view',
      path: '/view/*',
      component: ViewPage,
    },
    {
      name: 'manage_local_panels',
      path: '/local_panel',
      component: ManageLocalPanelsPage,
    },
    {
      name: 'view_local_panel',
      path: '/local_panel/:id',
      component: ViewLocalPanelPage,
    },
  ],
});

new Vue({ router, store, render: h => h(App) }).$mount('#app');
