const webpack = require('webpack');
const serveApi = require('./api');

module.exports = {
  lintOnSave: false,
  devServer: {
    before: serveApi,
    port: 5000,
  },
  pluginOptions: {
    webpackBundleAnalyzer: {
      openAnalyzer: false,
    },
  },
  configureWebpack: {
    plugins: [
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
    ],
  },
};
