#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, '..', 'packages', 'services', 'api', 'src', 'routes', 'admin_large.js');
const TARGET_CHARS = 699_000;

const header = `const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Account = require('../models/account');

// VULN 1: Hardcoded admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'P@ssw0rd123!';
const JWT_SECRET = 'supersecret';

// VULN 2: Authentication bypass via hardcoded creds + weak JWT secret
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ user: username, role: 'admin' }, JWT_SECRET);
    return res.json({ token });
  }
  res.status(401).json({ error: 'invalid' });
});

// VULN 3: Command injection via exec
router.get('/admin/diagnostics/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.target, (err, stdout, stderr) => {
    if (err) return res.status(500).send(stderr);
    res.type('text/plain').send(stdout);
  });
});

// VULN 4: eval of user-controlled body field
router.post('/admin/run', (req, res) => {
  const result = eval(req.body.code);
  res.json({ result });
});

// VULN 5: Path traversal in sendFile
router.get('/admin/files/:name', (req, res) => {
  const filePath = path.join('/etc/goatlin/', req.params.name);
  res.sendFile(filePath);
});

// VULN 6: Arbitrary file write controlled by client
router.post('/admin/files', (req, res) => {
  const target = path.join('/var/data/uploads', req.body.filename);
  fs.writeFileSync(target, req.body.content);
  res.json({ written: target });
});

// VULN 7: Reflected XSS
router.get('/admin/greet', (req, res) => {
  res.type('text/html').send(
    '<html><body><h1>Hello ' + req.query.name + '</h1></body></html>'
  );
});

// VULN 8: Open redirect
router.get('/admin/exit', (req, res) => {
  res.redirect(req.query.next);
});

// VULN 9: NoSQL injection — req.body objects flow into the query
router.post('/admin/lookup', async (req, res) => {
  const account = await Account.findOne({
    email: req.body.email,
    password: req.body.password,
  });
  res.json(account);
});

// VULN 10: Broken access control on user deletion
router.delete('/admin/users/:email', (req, res) => {
  const auth = req.headers['x-admin-token'];
  if (!auth) return res.status(401).end();
  Account.deleteOne({ email: req.params.email }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: req.params.email });
  });
});

// VULN 11: Insecure deserialization — trust JSON cookie role
router.get('/admin/whoami', (req, res) => {
  const raw = req.headers.cookie || '';
  const sessionCookie = raw.split(';').find((c) => c.trim().startsWith('session='));
  if (!sessionCookie) return res.status(401).end();
  const session = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
  res.json({ user: session.user, role: session.role });
});

module.exports = router;

/* ============================================================
 * Bulk padding below — random hex generated to inflate file size.
 * Not executed.
 * ============================================================
`;

const footer = `\n*/\n`;

const overhead = header.length + footer.length;
const padBytes = Math.ceil((TARGET_CHARS - overhead) / 2);
const padding = crypto.randomBytes(padBytes).toString('hex');
const wrapped = padding.match(/.{1,120}/g).join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + wrapped + footer);

const size = fs.statSync(OUT).size;
console.log(`Wrote ${OUT}`);
console.log(`Size: ${size.toLocaleString()} chars`);
