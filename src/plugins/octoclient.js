import { graphql } from '@octokit/graphql';

class OctoClient {
  constructor(token) {
    this.setToken(token);
  }

  setToken(token) {
    if (token) {
      this.request = graphql.defaults({
        headers: {
          authorization: `token ${token}`,
        },
      });
    } else {
      this.request = graphql;
    }
  }
}

const OctoClientPlugin = {
  install(Vue, _options) {
    Vue.prototype.$octoClient = new OctoClient();
  },
};

export default OctoClientPlugin;
