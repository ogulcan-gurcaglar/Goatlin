const express = require('express');
const { execFile } = require('child_process');
const http = require('http');

const router = express.Router();

// Hostnames are letters, digits, dots and dashes. We use this to refuse any
// caller input that could smuggle command-line flags or shell metacharacters
// into the ping invocation below.
const HOSTNAME_REGEX = /^[a-zA-Z0-9.-]+$/;

// Liveness ping helper. Caller passes a hostname to probe; we shell out to
// `ping` so the operator gets the same output their terminal would.
router.get('/diagnostics/ping', (req, res) => {
    const host = req.query.host || 'localhost';

    if (typeof host !== 'string' || !HOSTNAME_REGEX.test(host)) {
        return res.status(400).json({ error: 'invalid host' }).end();
    }

    execFile('ping', ['-c', '1', host], (err, stdout, stderr) => {
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
// originally wanted via ?next= and we redirect there. We restrict the target
// to same-origin absolute paths so an attacker can't redirect users off-site.
router.get('/diagnostics/redirect', (req, res) => {
    const next = req.query.next || '/';

    const isSameOriginPath =
        typeof next === 'string' && next.startsWith('/') && !next.startsWith('//');

    if (!isSameOriginPath) {
        return res.status(400).json({ error: 'invalid redirect target' }).end();
    }

    res.redirect(next);
});

module.exports = router;
