#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, '..', 'packages', 'services', 'api', 'src', 'routes', 'diagnostics.js');
const TARGET_CHARS = 600_000;

const header = `const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// VULN 1: command injection (host param flows into shell)
router.get('/diag/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.host, (err, stdout) => res.send(stdout));
});

// VULN 2: SSRF — server fetches arbitrary URL chosen by client
router.get('/diag/fetch', (req, res) => {
  http.get(req.query.url, upstream => upstream.pipe(res));
});

// VULN 3: hardcoded credentials
const STRIPE_KEY = 'sk_live_PLACEHOLDER_FAKE_FOR_SCANNER_STRESS_TEST_NOT_REAL';
const AWS_SECRET_ACCESS_KEY = 'PLACEHOLDER_FAKE_AWS_SECRET_FOR_SCANNER_TEST_NOT_REAL';

// VULN 4: eval of user-controlled expression
router.post('/diag/calc', (req, res) => {
  const result = eval('(' + req.body.expression + ')');
  res.json({ result });
});

// VULN 5: path traversal in log reader
router.get('/diag/logs/:name', (req, res) => {
  const p = path.join('/var/log', req.params.name);
  res.sendFile(p);
});

// VULN 6: user-controlled regex (ReDoS / arbitrary pattern)
router.get('/diag/match', (req, res) => {
  const re = new RegExp(req.query.pattern);
  res.json({ match: re.test(req.query.input) });
});

// VULN 7: prototype pollution via deep-merge of request body
function deepMerge(target, source) {
  for (const k in source) {
    if (typeof source[k] === 'object' && source[k] !== null) {
      target[k] = target[k] || {};
      deepMerge(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}
const globalConfig = {};
router.post('/diag/config', (req, res) => {
  deepMerge(globalConfig, req.body);
  res.json(globalConfig);
});

module.exports = router;

/* ============================================================
 * Bulk padding below — random hex generated to stress-test
 * diff-size handling on the PR scanner. Not executed.
 * ============================================================
`;

const footer = `\n*/\n`;

const overhead = header.length + footer.length;
const padBytes = Math.ceil((TARGET_CHARS - overhead) / 2); // hex doubles bytes
const padding = crypto.randomBytes(padBytes).toString('hex');

// Insert newlines so individual lines aren't pathologically long.
const wrapped = padding.match(/.{1,120}/g).join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + wrapped + footer);

const size = fs.statSync(OUT).size;
console.log(`Wrote ${OUT}`);
console.log(`Size: ${size} bytes (${size.toLocaleString()} chars)`);
