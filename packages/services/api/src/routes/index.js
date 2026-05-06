const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
  res.send('¯\\_(ツ)_/¯');
});

router.get('/health', function(req, res, next) {
  res.status(200).json({status: 'ok'}).end();
});

module.exports = router;
