const serveApi = require('./api');

module.exports = {
  lintOnSave: false,
  devServer: {
    before: serveApi,
    port: 5000,
  },
};
