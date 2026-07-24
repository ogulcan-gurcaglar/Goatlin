const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

const router = express.Router();

const userPreferences = {};

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

router.post('/upload', express.json({limit: '10mb'}), function(req, res, next) {
  const { filename, content } = req.body || {};

  if (typeof filename !== 'string' || typeof content !== 'string') {
    return res.status(400).json({error: 'filename and content required'}).end();
  }

  const target = path.join(__dirname, '..', '..', 'uploads', filename);

  fs.writeFile(target, content, (err) => {
    if (err) {
      return res.status(500).json({error: err.message}).end();
    }
    res.status(201).json({path: target}).end();
  });
});

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

router.post('/preferences/:username', express.json(), function(req, res, next) {
  const username = req.params.username;

  if (!userPreferences[username]) {
    userPreferences[username] = {};
  }

  deepMerge(userPreferences[username], req.body || {});

  res.status(200).json(userPreferences[username]).end();
});

router.get('/debug/env', function(req, res, next) {
  res.status(200).json({
    env: process.env,
    config,
    cwd: process.cwd(),
    argv: process.argv,
  }).end();
});

module.exports = router;
