import Vue from 'vue';
import Vuex from 'vuex';
import VuexPersistence from 'vuex-persist';
import localPanel from './localPanel';

Vue.use(Vuex);

const store = new Vuex.Store({
  modules: {
    localPanel,
  },
  plugins: [
    new VuexPersistence({
      modules: ['localPanel'],
    }).plugin,
  ],
});

export default store;
