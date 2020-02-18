import { Http } from 'vue-resource';

class OctoClient {
  async request(query, parameters) {
    const resp = await Http.post('/github/graphql', {
      query,
      parameters,
    });
    return resp.body;
  }
}

const OctoClientPlugin = {
  install(Vue, _options) {
    Vue.prototype.$octoClient = new OctoClient();
  },
};

export default OctoClientPlugin;
