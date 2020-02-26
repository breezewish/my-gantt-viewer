import Vue from 'vue';

export default {
  namespaced: true,
  state: {
    panels: {},
  },
  mutations: {
    addPanel(state, { id, name }) {
      const panel = {
        id,
        name,
        projects: {},
      };
      Vue.set(state.panels, id, panel);
    },
    deletePanel(state, { id }) {
      Vue.delete(state.panels, id);
    },
    renamePanel(state, { id, name }) {
      state.panels[id].name = name;
    },
    addProjects(state, { id, projects }) {
      projects.forEach(p => {
        Vue.set(state.panels[id].projects, p.id, {
          id: p.id,
          url: p.url,
          name: p.name,
        });
      });
    },
    deleteProject(state, { id, projectId }) {
      Vue.delete(state.panels[id].projects, projectId);
    },
  },
  actions: {},
  getters: {},
};
