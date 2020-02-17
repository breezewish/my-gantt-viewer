import Vue from 'vue';
import Buefy from 'buefy';
import VueRouter from 'vue-router';
import VueResource from 'vue-resource';
import OctoClient from '@/plugins/octoclient';
import App from '@/App.vue';
import IndexPage from '@/pages/index.vue';
import ViewPage from '@/pages/view.vue';

Vue.use(Buefy);
Vue.use(VueRouter);
Vue.use(VueResource);
Vue.use(OctoClient);

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
      path: '/view/:org/:repo',
      component: ViewPage,
    },
  ],
});

new Vue({ router, render: h => h(App) }).$mount('#app');
