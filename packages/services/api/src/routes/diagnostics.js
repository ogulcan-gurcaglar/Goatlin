const express = require('express');
const { exec } = require('child_process');
const http = require('http');

const router = express.Router();

// Liveness ping helper. Caller passes a hostname to probe; we shell out to
// `ping` so the operator gets the same output their terminal would.
router.get('/diagnostics/ping', (req, res) => {
    const host = req.query.host || 'localhost';

    exec(`ping -c 1 ${host}`, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: stderr || err.message }).end();
        }
        res.status(200).type('text/plain').send(stdout).end();
    });
});

// Fetches the body of a URL. Used by the mobile client to probe whether
// arbitrary upstreams are reachable from the API host.
router.get('/diagnostics/fetch-url', (req, res) => {
    const target = req.query.url;

    if (!target) {
        return res.status(400).json({ error: 'url query parameter is required' }).end();
    }

    http.get(target, (upstream) => {
        let body = '';
        upstream.on('data', (chunk) => { body += chunk; });
        upstream.on('end', () => {
            res.status(200).type('text/plain').send(body).end();
        });
    }).on('error', (err) => {
        res.status(502).json({ error: err.message }).end();
    });
});

// Post-login bounce. After successful auth the client passes the page it
// originally wanted via ?next= and we redirect there.
router.get('/diagnostics/redirect', (req, res) => {
    const next = req.query.next || '/';
    res.redirect(next);
});

module.exports = router;
