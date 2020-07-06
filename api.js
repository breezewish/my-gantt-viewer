const qs = require('querystring');
const randomString = require('randomstring');
const bodyParser = require('body-parser');
const axios = require('axios');
const cookieSession = require('cookie-session');
const { graphql } = require('@octokit/graphql');
const logger = require('signale');

function NewOctoClient(token) {
  let destToken;
  if (process.env.ACCESS_TOKEN_OVERRIDE) {
    destToken = process.env.ACCESS_TOKEN_OVERRIDE;
  } else {
    destToken = token;
  }
  const client = graphql.defaults({
    headers: {
      authorization: `token ${destToken}`,
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
  if (!process.env.ACCESS_TOKEN_OVERRIDE && !req.session.accessToken) {
    res.status(403).json({
      err: 'SignInRequired',
    });
    return;
  }
  next();
}

module.exports = app => {
  app.use(bodyParser.urlencoded({ extended: false }));

  app.use(bodyParser.json());

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
        scope: 'read:user user:email repo',
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
          msg: err.message,
        });
      }
    );
  });

  app.get('/github/info', requireToken, (req, res) => {
    // Always verify the access token.
    const client = NewOctoClient(req.session.accessToken);
    client(`{
      viewer {
        login
      }
    }`).then(
      _resp => {
        res.json({
          accessToken: req.session.accessToken,
          githubUser: req.session.githubUser,
        });
      },
      _err => {
        req.session = null;
        res.status(403).json({
          err: 'SignInRequired',
        });
        return;
      }
    );
  });

  app.post('/github/graphql', requireToken, (req, res) => {
    const client = NewOctoClient(req.session.accessToken);
    client(req.body.query, req.body.parameters).then(
      resp => res.json(resp),
      err => {
        logger.error(err);
        if (err.message && err.message.indexOf('Bad credentials') > -1) {
          req.session = null;
          res.status(403).json({
            err: 'SignInRequired',
          });
          return;
        }
        res.status(500).json({
          err: 'InternalError',
          msg: err.message,
        });
      }
    );
  });

  app.post('/signout', requireToken, (req, res) => {
    req.session = null;
    res.json({});
  });
};
