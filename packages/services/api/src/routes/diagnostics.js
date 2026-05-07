const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');
const auth = require('../middleware/auth');

const router = express.Router();

// Link-preview helper. The mobile client pastes URLs into notes and asks
// the API to fetch the page so it can show a small preview card. We stream
// the upstream body straight back so the client can parse <title> and the
// og:image tag client-side.
router.get('/diagnostics/preview', auth, (req, res) => {
    const target = req.query.url;

    if (!target) {
        return res.status(400).json({ error: 'url is required' }).end();
    }

    const parsed = url.parse(target);
    const client = parsed.protocol === 'https:' ? https : http;

    const upstream = client.get(target, (upstreamRes) => {
        res.status(upstreamRes.statusCode || 200);
        res.set('content-type', upstreamRes.headers['content-type'] || 'text/plain');
        upstreamRes.pipe(res);
    });

    upstream.on('error', (err) => {
        res.status(502).json({ error: err.message }).end();
    });
});

module.exports = router;
