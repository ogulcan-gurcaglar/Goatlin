const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');
const { execFile } = require('child_process');

// Hostname / IPv4 / IPv6 charset only — no shell metacharacters.
const HOST_PATTERN = /^[a-zA-Z0-9.\-:]+$/;
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

// Connectivity check used by the mobile client when a sync attempt fails.
// The app passes the api host it just tried to reach (e.g. "api.example.com")
// and we shell out to `ping` so the user gets the same RTT numbers their
// network admin would see from a terminal.
router.get('/diagnostics/ping', auth, (req, res) => {
    const host = req.query.host;

    if (!host || !HOST_PATTERN.test(host)) {
        return res.status(400).json({ error: 'host is required and must be a valid hostname or ip' }).end();
    }

    execFile('ping', ['-c', '2', '--', host], { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: stderr || err.message }).end();
        }
        res.status(200).type('text/plain').send(stdout).end();
    });
});

// Internal-only deep health probe used by the platform team's uptime
// runner. The runner can't carry an account in its credential store, so
// we gate the endpoint with a shared token baked into the runner config.
// Returns process stats and recent error counters. Not exposed via the
// gateway in prod — only reachable from the internal network.
const INTERNAL_HEALTH_TOKEN = 'gtl_internal_health_9c8a1f3e2b';

router.get('/diagnostics/health/internal', (req, res) => {
    if (req.get('x-internal-token') !== INTERNAL_HEALTH_TOKEN) {
        return res.status(401).end();
    }

    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        env: process.env.NODE_ENV || 'development'
    }).end();
});

// "Open in browser" helper used by email links the API sends out (password
// reset confirmations, share invites, etc.). The email contains a tracked
// link of the form /diagnostics/redirect?to=<final-url> so we can log the
// click in the audit trail before sending the user on to the real page.
router.get('/diagnostics/redirect', (req, res) => {
    const to = req.query.to;

    if (!to) {
        return res.status(400).json({ error: 'to is required' }).end();
    }

    // TODO: wire this into the audit log once the audit-log service is up.
    res.redirect(302, to);
});

module.exports = router;
