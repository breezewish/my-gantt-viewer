const qs = require('querystring');
const randomString = require('randomstring');
const axios = require('axios');
const cookieSession = require('cookie-session');
const { graphql } = require('@octokit/graphql');
const logger = require('signale');

function NewOctoClient(token) {
  const client = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });
  return client;
}

async function acquireOAuthToken(code, state) {
  const oauthResp = await axios.request({
    method: 'post',
    url:
      'https://github.com/login/oauth/access_token?' +
      qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        state,
      }),
    headers: {
      accept: 'application/json',
    },
  });
  if (!oauthResp.data.access_token) {
    throw new Error('Invalid AccessToken response');
  }
  const client = NewOctoClient(oauthResp.data.access_token);
  const resp = await client(`{
    viewer {
      login
      avatarUrl
      id
      name
    }
  }`);
  if (!resp || !resp.viewer) {
    throw new Error('Invalid GitHub Authenticated response');
  }
  return {
    accessToken: oauthResp.data.access_token,
    githubUser: resp.viewer,
  };
}

function requireToken(req, res, next) {
  if (!req.session.accessToken) {
    res.status(403).json({
      err: 'SignInRequired',
    });
    return;
  }
  next();
}

module.exports = app => {
  app.use(
    cookieSession({
      name: 'session',
      keys: [process.env.SESSION_SECRET],
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
  );

  app.get('/github/signin', (req, res) => {
    req.session.oAuthState = randomString.generate();
    const githubAuthUrl =
      'https://github.com/login/oauth/authorize?' +
      qs.stringify({
        client_id: process.env.CLIENT_ID,
        redirect_uri:
          process.env.SERVER_HOST +
          '/github/callback?' +
          qs.stringify({ redirect: req.query.redirect }),
        state: req.session.oAuthState,
        scope: 'read:user user:email public_repo',
      });
    res.redirect(githubAuthUrl);
  });

  app.get('/github/callback', (req, res) => {
    if (req.session.oAuthState !== req.query.state) {
      logger.error('Check OAuthState failed', req.query, req.session);
      res.status(403).json({
        err: 'InvaildOAuthState',
      });
      return;
    }

    acquireOAuthToken(req.query.code, req.query.state).then(
      data => {
        req.session.accessToken = data.accessToken;
        req.session.githubUser = data.githubUser;
        logger.success('OAuth SignIn success', {
          token: data.accessToken,
          login: data.githubUser.login,
        });
        if (req.query.redirect) {
          res.redirect(req.query.redirect);
        } else {
          res.redirect('/');
        }
      },
      err => {
        logger.error(err);
        res.status(500).json({
          err: 'InternalError',
        });
      }
    );
  });

  app.get('/github/info', requireToken, (req, res) => {
    res.json({
      accessToken: req.session.accessToken,
      githubUser: req.session.githubUser,
    });
  });

  app.post('/signout', requireToken, (req, res) => {
    req.session = null;
    res.json({});
  });

  // app.get('/test/projects', requireToken, (req, res) => {
  //   const octokit = NewOctokit(req.session.accessToken);
  //   octokit.projects.listForRepo({
  //     owner: 'pingcap-incubator',
  //     repo: 'tidb-dashboard',
  //   }).then(v => res.json(v.data));
  // });

  // app.get('/test/project/:id', requireToken, (req, res) => {
  //   const octokit = NewOctokit(req.session.accessToken);
  //   octokit.projects.listColumns({
  //     project_id: req.params.id,
  //   }).then(v => res.json(v.data));
  // });

  // app.get('/test/issues', requireToken, (req, res) => {
  //   const octokit = NewOctokit(req.session.accessToken);
  //   octokit.issues.listForRepo({
  //     owner: 'pingcap-incubator',
  //     repo: 'tidb-dashboard',
  //   }).then(v => res.json(v.data));
  // });
};
