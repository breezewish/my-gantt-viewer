require('dotenv').config();

const express = require('express');
const path = require('path');
const qs = require('querystring');
const randomString = require('randomstring');
const axios = require('axios');
const cookieSession = require('cookie-session');
const logger = require('signale');
const { Octokit } = require('@octokit/rest');

const app = express();

function NewOctokit(token) {
  return new Octokit({
    auth: token,
    timeZone: 'Asia/Shanghai',
    log: logger,
  });
}

app.use(express.static(path.join(__dirname, 'dist')));

app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET],
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
}));

app.get('/view/*', (req, res) => {
  res.sendFile(path.join(__dirname, '/dist/index.html'));
});

app.get('/github/signin', (req, res) => {
  req.session.oAuthState = randomString.generate();
  const githubAuthUrl = 'https://github.com/login/oauth/authorize?' +
    qs.stringify({
      client_id: process.env.CLIENT_ID,
      redirect_uri: process.env.SERVER_HOST + '/github/callback',
      state: req.session.oAuthState,
      scope: 'read:user user:email'
    });
  res.redirect(githubAuthUrl);
});

async function acquireOAuthToken(code, state) {
  const oauthResp = await axios.request({
    method: 'post',
    url: 'https://github.com/login/oauth/access_token?' + qs.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.SERVER_HOST + '/github/callback',
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
  const octokit = NewOctokit(oauthResp.data.access_token);
  const userResp = await octokit.users.getAuthenticated();
  if (!userResp.data.login) {
    throw new Error('Invalid GitHub Authenticated response');
  }
  return {
    accessToken: oauthResp.data.access_token,
    githubUser: userResp.data,
  };
}

app.get('/github/callback', (req, res) => {
  if (req.session.oAuthState !== req.query.state) {
    logger.error('Check OAuthState failed', req.query, req.session);
    res.status(403).json({
      err: 'InvaildOAuthState',
    });
    return;
  }

  acquireOAuthToken(req.query.code, req.query.state)
    .then(data => {
      req.session.accessToken = data.accessToken;
      req.session.githubUser = {
        login: data.githubUser.login,
        id: data.githubUser.id,
        name: data.githubUser.name,
      };
      logger.success('OAuth SignIn success', {
        token: data.accessToken,
        login: data.githubUser.login,
      });
      res.redirect('/');
    }, err => {
      logger.error(err);
      res.status(500).json({
        err: 'InternalError',
      });
    });
});

function requireToken(req, res, next) {
  if (!req.session.accessToken) {
    res.status(403).json({
      err: 'SignInRequired'
    });
    return;
  }
  next();
}

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.success(`Listening on ${ PORT }`));
