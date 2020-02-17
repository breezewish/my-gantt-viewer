<template>
  <b-navbar type="is-light">
    <template slot="brand">
      <b-navbar-item tag="router-link" :to="{ path: '/' }">
        GanttViewer
      </b-navbar-item>
    </template>
    <template slot="start">
      <b-navbar-item tag="div">
        <small>for:</small>
        <b-autocomplete
          :data="repoNavData"
          placeholder="Type to search a repository"
          :loading="repoNavIsLoading > 0"
          field="display"
          @typing="searchRepos"
          size="is-small"
          style="width: 300px; margin-left: 5px;"
          :value="
            $route.params.repo
              ? `${$route.params.org}/${$route.params.repo}`
              : ''
          "
          @select="handleRepoChange"
        >
          >
          <template slot-scope="props">
            <div>
              <small>{{ props.option.display }}</small>
            </div>
            <div>
              <small>
                <b-icon size="is-small" icon="star" />{{
                  props.option.stargazers.totalCount
                }}
                <b-icon size="is-small" icon="source-branch" />{{
                  props.option.forkCount
                }}
              </small>
            </div>
          </template>
        </b-autocomplete>
      </b-navbar-item>
    </template>
    <template slot="end">
      <b-navbar-dropdown v-if="sessionInfo && sessionInfo.githubUser">
        <template slot="label">
          <img
            :src="sessionInfo.githubUser.avatarUrl"
            style="margin-right: 5px"
          />
          {{ sessionInfo.githubUser.login }}
        </template>
        <b-navbar-item href="javascript:;" @click="logout">
          Logout
        </b-navbar-item>
      </b-navbar-dropdown>
    </template>
  </b-navbar>
</template>

<script>
import throttle from 'lodash/throttle';

export default {
  name: 'Nav',
  data() {
    return {
      repoNavData: [],
      repoNavSelected: null,
      repoNavIsLoading: 0,
    };
  },
  props: ['repo', 'sessionInfo'],
  methods: {
    logout: async function() {
      try {
        await this.$http.post('/signout');
        window.location.reload();
      } catch (e) {
        console.error(e);
        this.$buefy.toast.open({
          duration: 5000,
          message: `Sign out failed`,
          position: 'is-bottom',
          type: 'is-danger',
          queue: false,
        });
      }
    },
    handleRepoChange: function(option) {
      console.log('repoChange');
      if (!option) {
        return;
      }
      this.$router.push({
        name: 'view',
        params: {
          org: option.owner.login,
          repo: option.name,
        },
      });
    },
    searchRepos: throttle(async function(name) {
      if (!name.length) {
        this.repoNavData = [];
        return;
      }
      this.repoNavIsLoading++;
      try {
        const query = await this.$octoClient.request(
          `
          query repos($name: String!) {
            search(query: $name, type: REPOSITORY, first: 10) {
              nodes {
                ... on Repository {
                  id
                  name
                  url
                  owner {
                    login
                  }
                  forkCount
                  stargazers {
                    totalCount
                  }
                }
              }
            }
          }
        `,
          {
            name,
          }
        );
        if (query && query.search && query.search.nodes) {
          this.repoNavData = [];
          query.search.nodes.forEach(node => {
            this.repoNavData.push({
              ...node,
              display: `${node.owner.login}/${node.name}`,
            });
          });
        }
      } catch (e) {
        console.error(e);
        this.$buefy.toast.open({
          duration: 3000,
          message: `Search repository failed`,
          position: 'is-bottom',
          type: 'is-danger',
          queue: false,
        });
      }
      this.repoNavIsLoading--;
    }, 500),
  },
};
</script>
