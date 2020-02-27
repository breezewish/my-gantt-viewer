<template>
  <div style="height: 100%; display: grid; grid-template-rows: 180px auto;">
    <vue-headful title="Manage Local Panels - GanttViewer" />
    <section class="hero is-primary">
      <div class="hero-body">
        <div class="container">
          <h1 class="title">Manage Local Panels</h1>
          <b-field grouped group-multiline>
            <p class="control">
              <b-button
                type="is-primary"
                size="is-small"
                rounded
                inverted
                @click="handleAddLocalPanel"
                >Add Local Panel</b-button
              >
            </p>
            <p class="control">
              <b-button
                type="is-primary"
                size="is-small"
                rounded
                inverted
                outlined
                @click="handleImportPanel"
                >Import Panel JSON</b-button
              >
            </p>
          </b-field>
        </div>
      </div>
    </section>
    <section class="section" style="overflow-y: scroll;">
      <div class="container">
        <b-collapse class="card" v-for="panel of panels" :key="panel.id" style="margin: 10px 0;">
          <div slot="trigger" slot-scope="props" class="card-header">
            <p class="card-header-title">Panel: {{ panel.name }}</p>
            <a class="card-header-icon">
              <b-icon :icon="props.open ? 'menu-down' : 'menu-up'"></b-icon>
            </a>
          </div>
          <div class="card-content">
            <b-field>
              <b-input
                size="is-small"
                placeholder="URL or org/repo"
                @input="handleProjectSourceChange(panel.id, $event)"
                v-model="inputs[panel.id]"
                expanded
                @keyup.native.enter="handleAddProjectFromInput(panel.id)"
                :disabled="
                  addProjectStates[panel.id] &&
                    addProjectStates[panel.id].loading
                "
              ></b-input>
              <p class="control">
                <b-button
                  size="is-small"
                  disabled
                  v-if="!addProjectStates[panel.id]"
                  @click="handleAddProjectFromInput(panel.id)"
                  >Add projects</b-button
                >
                <b-button
                  size="is-small"
                  type="is-primary"
                  v-if="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].type === 'org'
                  "
                  @click="handleAddProjectFromInput(panel.id)"
                  :loading="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].loading
                  "
                >
                  Add projects from
                  <b>organization</b>
                  {{ addProjectStates[panel.id].org }}
                </b-button>
                <b-button
                  size="is-small"
                  type="is-success"
                  v-if="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].type === 'repo'
                  "
                  @click="handleAddProjectFromInput(panel.id)"
                  :loading="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].loading
                  "
                >
                  Add projects from
                  <b>repository</b>
                  {{ addProjectStates[panel.id].org }}/{{
                    addProjectStates[panel.id].repo
                  }}
                </b-button>
                <b-button
                  size="is-small"
                  type="is-warning"
                  v-if="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].type === 'org_project'
                  "
                  @click="handleAddProjectFromInput(panel.id)"
                  :loading="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].loading
                  "
                >
                  Add
                  <b>project id</b>
                  {{ addProjectStates[panel.id].project_num }} from
                  <b>organization</b>
                  {{ addProjectStates[panel.id].org }}
                </b-button>
                <b-button
                  size="is-small"
                  type="is-warning"
                  v-if="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].type === 'repo_project'
                  "
                  @click="handleAddProjectFromInput(panel.id)"
                  :loading="
                    addProjectStates[panel.id] &&
                      addProjectStates[panel.id].loading
                  "
                >
                  Add
                  <b>project id</b>
                  {{ addProjectStates[panel.id].project_num }} from
                  <b>repository</b>
                  {{ addProjectStates[panel.id].org }}/{{
                    addProjectStates[panel.id].repo
                  }}
                </b-button>
              </p>
            </b-field>
            <div class="content" style="font-size: 14px">
              <b-table :data="Object.values(panel.projects)" narrowed>
                <template slot-scope="props">
                  <b-table-column label="Project Name" width="200">{{
                    props.row.name
                  }}</b-table-column>
                  <b-table-column label="URL">
                    <a :href="props.row.url" target="_blank">
                      {{ props.row.url }}
                    </a>
                  </b-table-column>
                  <b-table-column label="Action" width="100">
                    <b-button
                      size="is-small"
                      rounded
                      outlined
                      @click="handleDeleteProjectPanel(panel.id, props.row.id)"
                      >Delete</b-button
                    >
                    <!-- <b-button size="is-small" rounded outlined>↑</b-button>
                    <b-button size="is-small" rounded outlined>↓</b-button>-->
                  </b-table-column>
                </template>
              </b-table>
            </div>
          </div>
          <footer class="card-footer">
            <router-link
              class="card-footer-item"
              :to="{ name: 'view_local_panel', params: { id: panel.id } }"
              >View Panel</router-link
            >
            <a class="card-footer-item" @click="handleRenamePanel(panel.id)"
              >Rename Panel</a
            >
            <a class="card-footer-item" @click="handleDeletePanel(panel.id)"
              >Delete Panel</a
            >
            <a class="card-footer-item" @click="handleExportPanel(panel.id)"
              >Export Panel JSON</a
            >
          </footer>
        </b-collapse>
      </div>
    </section>
  </div>
</template>

<script>
import Vue from 'vue';
import { mapMutations, mapState } from 'vuex';
import { v4 as uuidv4 } from 'uuid';
import gh from 'parse-github-url';
import Ajv from 'ajv';

const ajv = new Ajv();
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

const validatePanelSchema = ajv.compile(require('./localPanelSchema.json'));

export default {
  name: 'ManageLocalPanelsPage',
  computed: mapState('localPanel', ['panels']),
  data() {
    return {
      addProjectStates: {},
      inputs: {},
    };
  },
  methods: {
    ...mapMutations('localPanel', [
      'addPanel',
      'deletePanel',
      'renamePanel',
      'addProjects',
      'deleteProject',
      'importPanel',
    ]),
    handleQueryError(e) {
      console.error(e);
      let message = 'Request failed';
      if (e.body && e.body.msg) {
        message = e.body.msg;
      } else if (e.message) {
        message = e.message;
      }
      this.$buefy.toast.open({
        duration: 5000,
        message: message,
        position: 'is-bottom',
        type: 'is-danger',
        queue: false,
      });
    },
    handleProjectSourceChange(panelId, inputValue) {
      if (inputValue.trim() === '') {
        Vue.set(this.addProjectStates, panelId, null);
        return;
      }
      {
        // Example: https://github.com/orgs/pingcap/projects/8
        const m = inputValue.match(
          /github\.com\/orgs\/([-\w\d\.\_]+)\/projects\/(\d+)/
        );
        if (m) {
          Vue.set(this.addProjectStates, panelId, {
            type: 'org_project',
            org: m[1],
            project_num: parseInt(m[2]),
          });
          return;
        }
      }
      {
        // Example: https://github.com/tikv/tikv/projects/26
        const m = inputValue.match(
          /github\.com\/([-\w\d\.\_]+)\/([-\w\d\.\_]+)\/projects\/(\d+)/
        );
        if (m) {
          Vue.set(this.addProjectStates, panelId, {
            type: 'repo_project',
            org: m[1],
            repo: m[2],
            project_num: parseInt(m[3]),
          });
          return;
        }
      }
      {
        // Example: pingcap
        const m = inputValue.match(/^([\w\d\.]+)$/);
        if (m) {
          Vue.set(this.addProjectStates, panelId, {
            type: 'org',
            org: m[1],
          });
          return;
        }
      }
      const r = gh(inputValue);
      if (r.owner && !r.name) {
        Vue.set(this.addProjectStates, panelId, {
          type: 'org',
          org: r.owner,
        });
      } else if (r.owner && r.name) {
        if (r.owner === 'orgs') {
          // Example: https://github.com/orgs/pingcap/projects
          Vue.set(this.addProjectStates, panelId, {
            type: 'org',
            org: r.name,
          });
        } else {
          Vue.set(this.addProjectStates, panelId, {
            type: 'repo',
            org: r.owner,
            repo: r.name,
          });
        }
      } else {
        Vue.set(this.addProjectStates, panelId, null);
      }
    },
    handleAddProjectFromInput(panelId) {
      const addInfo = this.addProjectStates[panelId];
      if (!addInfo) {
        return;
      }
      if (addInfo.loading) {
        return;
      }
      switch (addInfo.type) {
        case 'org':
          this.addProjectFromOrg(panelId, addInfo);
          break;
        case 'repo':
          this.addProjectFromRepo(panelId, addInfo);
          break;
        case 'org_project':
          this.addProjectFromOrgProject(panelId, addInfo);
          break;
        case 'repo_project':
          this.addProjectFromRepoProject(panelId, addInfo);
          break;
      }
    },
    async addProjectFromOrg(panelId, addInfo) {
      Vue.set(addInfo, 'loading', true);
      try {
        const projects = await this.$octoClient.loadEnabledProjectsFromOrg(
          addInfo.org
        );
        this.addProjects({ id: panelId, projects });
        Vue.set(this.inputs, panelId, '');
        Vue.set(this.addProjectStates, panelId, null);
      } catch (e) {
        this.handleQueryError(e);
      }
      Vue.set(addInfo, 'loading', false);
    },
    async addProjectFromRepo(panelId, addInfo) {
      Vue.set(addInfo, 'loading', true);
      try {
        const projects = await this.$octoClient.loadEnabledProjectsFromRepo(
          addInfo.org,
          addInfo.repo
        );
        this.addProjects({ id: panelId, projects });
        Vue.set(this.inputs, panelId, '');
        Vue.set(this.addProjectStates, panelId, null);
      } catch (e) {
        this.handleQueryError(e);
      }
      Vue.set(addInfo, 'loading', false);
    },
    async addProjectFromOrgProject(panelId, addInfo) {
      Vue.set(addInfo, 'loading', true);
      try {
        const project = await this.$octoClient.getOrgProject(
          addInfo.org,
          addInfo.project_num
        );
        this.addProjects({ id: panelId, projects: [project] });
        Vue.set(this.inputs, panelId, '');
        Vue.set(this.addProjectStates, panelId, null);
      } catch (e) {
        this.handleQueryError(e);
      }
      Vue.set(addInfo, 'loading', false);
    },
    async addProjectFromRepoProject(panelId, addInfo) {
      Vue.set(addInfo, 'loading', true);
      try {
        const project = await this.$octoClient.getRepoProject(
          addInfo.org,
          addInfo.repo,
          addInfo.project_num
        );
        this.addProjects({ id: panelId, projects: [project] });
        Vue.set(this.inputs, panelId, '');
        Vue.set(this.addProjectStates, panelId, null);
      } catch (e) {
        this.handleQueryError(e);
      }
      Vue.set(addInfo, 'loading', false);
    },
    // handleRefreshProjectNames() {},
    handleImportPanel() {
      this.$buefy.dialog.prompt({
        animation: 'zoom-in',
        title: 'Import Panel JSON',
        message: `Please input the panel JSON below`,
        trapFocus: true,
        inputAttrs: {
          style: 'font-size: 12px',
        },
        onConfirm: json => {
          // FIXME: Use JSON schema validate
          try {
            const d = JSON.parse(json);
            if (!validatePanelSchema(d)) {
              throw new Error('Invalid panel JSON schema');
            }
            this.importPanel({ panel: d });
          } catch (e) {
            console.log(e);
            this.$buefy.toast.open({
              duration: 5000,
              message: 'Failed to import JSON: ' + e.message,
              position: 'is-bottom',
              type: 'is-danger',
              queue: false,
            });
          }
        },
      });
    },
    handleAddLocalPanel() {
      this.$buefy.dialog.prompt({
        animation: 'zoom-in',
        title: 'Add Panel',
        message: `Panel name`,
        trapFocus: true,
        onConfirm: name => {
          const id = uuidv4();
          this.addPanel({ id, name });
        },
      });
    },
    handleDeleteProjectPanel(panelId, projectId) {
      this.deleteProject({ id: panelId, projectId });
    },
    handleRenamePanel(panelId) {
      this.$buefy.dialog.prompt({
        animation: 'zoom-in',
        title: 'Rename Panel',
        message: `New panel name`,
        trapFocus: true,
        inputAttrs: {
          value: this.panels[panelId].name,
        },
        onConfirm: name => {
          this.renamePanel({ id: panelId, name });
        },
      });
    },
    handleDeletePanel(panelId) {
      this.$buefy.dialog.confirm({
        animation: 'zoom-in',
        title: 'Delete Panel',
        message: 'Are you sure want to delete this panel?',
        confirmText: 'Delete',
        onConfirm: () => {
          this.deletePanel({ id: panelId });
        },
      });
    },
    async handleExportPanel(panelId) {
      const data = JSON.stringify(this.panels[panelId]);
      try {
        await this.$copyText(data);
        this.$buefy.toast.open({
          duration: 5000,
          message: 'Panel JSON copied to clipboard.',
          position: 'is-bottom',
          type: 'is-success',
          queue: false,
        });
      } catch (e) {
        this.$buefy.toast.open({
          duration: 5000,
          message: 'Failed to copy panel JSON to clipboard.',
          position: 'is-bottom',
          type: 'is-danger',
          queue: false,
        });
      }
    },
  },
};
</script>
