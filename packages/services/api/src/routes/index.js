const express = require('express');
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

const router = express.Router();

router.get('/', function(req, res, next) {
  res.send('¯\\_(ツ)_/¯');
});

router.get('/health', function(req, res, next) {
  res.status(200).json({status: 'ok'}).end();
});

router.get('/version', function(req, res, next) {
  res.status(200).json({name: pkg.name, version: pkg.version}).end();
});

router.get('/static/:filename', function(req, res, next) {
  const filePath = path.join(__dirname, '..', '..', 'public', req.params.filename);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({error: err.message}).end();
    }

    res.status(200).type('text/plain').send(data).end();
  });
});

module.exports = router;
