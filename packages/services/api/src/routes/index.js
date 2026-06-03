const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

const router = express.Router();

router.get('/', function(req, res, next) {
  res.send('¯\\_(ツ)_/¯');
});

router.get('/static/:filename', function(req, res, next) {
  const filePath = path.join( __dirname, '..', '..', 'public', req.params.filename );

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({error: err.message}).end();
    }

    res.status(200).type('text/plain').send(data).end();
  });
});

router.get('/fetch-url', function(req, res, next) {
  const target = req.query.url;

  if (typeof target !== 'string' || target === '') {
    return res.status(400).json({error: 'url query param required'}).end();
  }

  const parsed = url.parse(target);
  const client = parsed.protocol === 'https:' ? https : http;

  client.get(target, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      res.status(upstream.statusCode || 200)
        .type(upstream.headers['content-type'] || 'text/plain')
        .send(body)
        .end();
    });
  }).on('error', (err) => {
    res.status(502).json({error: err.message}).end();
  });
});

module.exports = router;
