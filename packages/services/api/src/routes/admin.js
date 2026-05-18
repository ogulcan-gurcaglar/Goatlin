const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Account = require('../models/account');

// ---------------------------------------------------------------------------
// VULN 1: Hardcoded admin credentials in source.
// ---------------------------------------------------------------------------
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'P@ssw0rd123!';
const JWT_SECRET = 'supersecret';

// ---------------------------------------------------------------------------
// VULN 2: Authentication bypass — anyone can log in as admin if they know
// the hardcoded constants above. No rate limit. JWT signed with weak secret.
// ---------------------------------------------------------------------------
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ user: username, role: 'admin' }, JWT_SECRET);
    return res.json({ token });
  }
  res.status(401).json({ error: 'invalid' });
});

// ---------------------------------------------------------------------------
// VULN 3: Command injection — req.query.target flows straight into shell.
// ---------------------------------------------------------------------------
router.get('/admin/diagnostics/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.target, (err, stdout, stderr) => {
    if (err) return res.status(500).send(stderr);
    res.type('text/plain').send(stdout);
  });
});

// ---------------------------------------------------------------------------
// VULN 4: Command injection (different sink) — `eval` of a body field.
// ---------------------------------------------------------------------------
router.post('/admin/run', (req, res) => {
  const result = eval(req.body.code);
  res.json({ result });
});

// ---------------------------------------------------------------------------
// VULN 5: Path traversal — sendFile of an unsanitised user-controlled path.
// ---------------------------------------------------------------------------
router.get('/admin/files/:name', (req, res) => {
  const filePath = path.join('/etc/goatlin/', req.params.name);
  res.sendFile(filePath);
});

// ---------------------------------------------------------------------------
// VULN 6: Arbitrary file write — content + filename from request.
// ---------------------------------------------------------------------------
router.post('/admin/files', (req, res) => {
  const target = path.join('/var/data/uploads', req.body.filename);
  fs.writeFileSync(target, req.body.content);
  res.json({ written: target });
});

// ---------------------------------------------------------------------------
// VULN 7: Reflected XSS — query param echoed back as HTML.
// ---------------------------------------------------------------------------
router.get('/admin/greet', (req, res) => {
  res.type('text/html').send(
    '<html><body><h1>Hello ' + req.query.name + '</h1></body></html>'
  );
});

// ---------------------------------------------------------------------------
// VULN 8: Open redirect — redirect target controlled by client.
// ---------------------------------------------------------------------------
router.get('/admin/exit', (req, res) => {
  res.redirect(req.query.next);
});

// ---------------------------------------------------------------------------
// VULN 9: NoSQL injection — req.body objects flow directly into the query.
// An attacker can pass `{"$ne": null}` to bypass auth.
// ---------------------------------------------------------------------------
router.post('/admin/lookup', async (req, res) => {
  const account = await Account.findOne({
    email: req.body.email,
    password: req.body.password,
  });
  res.json(account);
});

// ---------------------------------------------------------------------------
// VULN 10: Broken access control — token role is trusted but never verified
// against the account record, and the endpoint deletes any user.
// ---------------------------------------------------------------------------
router.delete('/admin/users/:email', (req, res) => {
  const auth = req.headers['x-admin-token'];
  if (!auth) return res.status(401).end();
  Account.deleteOne({ email: req.params.email }, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: req.params.email });
  });
});

// ---------------------------------------------------------------------------
// VULN 11: Insecure deserialization — JSON cookie is parsed and its `role`
// field is trusted as the caller's role.
// ---------------------------------------------------------------------------
router.get('/admin/whoami', (req, res) => {
  const raw = req.headers.cookie || '';
  const sessionCookie = raw.split(';').find((c) => c.trim().startsWith('session='));
  if (!sessionCookie) return res.status(401).end();
  const session = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
  res.json({ user: session.user, role: session.role });
});

module.exports = router;
