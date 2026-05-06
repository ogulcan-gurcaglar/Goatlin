const express = require('express');
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

module.exports = router;
