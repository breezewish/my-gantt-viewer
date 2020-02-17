require('dotenv').config();

const express = require('express');
const compression = require('compression');
const path = require('path');
const logger = require('signale');
const serveApi = require('./api');

const app = express();

app.use(compression());
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/view/*', (req, res) => {
  res.sendFile(path.join(__dirname, '/dist/index.html'));
});

serveApi(app);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.success(`Listening on ${PORT}`));
