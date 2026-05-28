const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', function(req, res, next) {
  res.send('¯\\_(ツ)_/¯');
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

router.get('/redirect', function(req, res, next) {
  const target = req.query.to;
  if (typeof target !== 'string' || target === '') {
    return res.status(400).json({error: 'to query param required'}).end();
  }
  res.redirect(target);
});

module.exports = router;
