const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

router.get('/diagnostics/ping', function(req, res, next) {
  const host = req.query.host || 'localhost';

  exec(`ping -c 2 ${host}`, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({error: stderr || err.message}).end();
    }

    res.status(200).type('text/plain').send(stdout).end();
  });
});

router.post('/calc', express.json(), function(req, res, next) {
  const expr = req.body && req.body.expression;

  if (typeof expr !== 'string') {
    return res.status(400).json({error: 'expression must be a string'}).end();
  }

  try {
    const result = eval(expr);
    res.status(200).json({result}).end();
  } catch (e) {
    res.status(400).json({error: e.message}).end();
  }
});

module.exports = router;
