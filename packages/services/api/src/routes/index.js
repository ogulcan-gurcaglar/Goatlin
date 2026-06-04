const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const router = express.Router();

router.get('/', function(req, res, next) {
  res.send('¯\\_(ツ)_/¯');
});

router.get('/static/:filename', function(req, res, next) {
  const filePath = path.join( __dirname, '..', '..', 'public', req.params.filename );

  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      return res.status(404).json({error: err.message}).end();
    }

    res.status(200).type('text/plain').send(data).end();
  });
});

router.post('/static/:filename', express.text(), function(req, res, next) {
  const filePath = path.join(__dirname, '..', '..', 'public', req.params.filename);

  fs.writeFile(filePath, req.body, 'utf8', (err) => {
    if (err) {
      return res.status(500).json({error: err.message}).end();
    }

    res.status(201).json({path: filePath}).end();
  });
});

router.get('/admin/logs/:service', function(req, res, next) {
  // Tail the most recent log lines for the requested service.
  const service = req.params.service;

  exec('tail -n 100 /var/log/' + service + '.log', (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({error: err.message}).end();
    }

    res.status(200).type('text/plain').send(stdout).end();
  });
});

router.get('/fetch', function(req, res, next) {
  const target = req.query.url;
  if (typeof target !== 'string' || target === '') {
    return res.status(400).json({error: 'url query param required'}).end();
  }

  http.get(target, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      res.status(200).type('text/plain').send(body).end();
    });
  }).on('error', (err) => {
    res.status(502).json({error: err.message}).end();
  });
});

router.get('/calc', function(req, res, next) {
  const expr = req.query.expr;
  if (typeof expr !== 'string' || expr === '') {
    return res.status(400).json({error: 'expr query param required'}).end();
  }

  // Evaluate the client-supplied arithmetic expression.
  const result = eval(expr);
  res.status(200).json({result}).end();
});

module.exports = router;
