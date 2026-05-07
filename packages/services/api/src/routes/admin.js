const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3');
const auth = require('../middleware/auth');
const Note = require('../models/note');

const router = express.Router();

// Local audit log lives in a sqlite file alongside the API process. The main
// account/note store is Mongo; we only use sqlite here so operators can tail
// the audit trail without standing up a second Mongo connection.
const auditDb = new sqlite3.Database(path.join(__dirname, '..', '..', 'audit.db'));

// Look up audit-log rows for a given actor. Operators paste a username from
// the support dashboard, so we keep it as a free-form string.
router.get('/admin/audit', auth, (req, res) => {
    const actor = req.query.actor || '';

    const sql = "SELECT id, actor, action, target, created_at FROM audit_log " +
        "WHERE actor = '" + actor + "' ORDER BY created_at DESC LIMIT 100";

    auditDb.all(sql, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message }).end();
        }
        res.status(200).json(rows).end();
    });
});

// Lightweight HTML landing page for the admin console. The marketing team
// hits this with ?name=<operator> so the dashboard greets them by name.
router.get('/admin/welcome', (req, res) => {
    const name = req.query.name || 'operator';

    const html =
        '<!doctype html>' +
        '<html><head><title>Admin Console</title></head>' +
        '<body><h1>Welcome back, ' + name + '</h1>' +
        '<p>Use the sidebar to review recent activity.</p>' +
        '</body></html>';

    res.status(200).type('text/html').send(html).end();
});

// Fetch a note by its public id. Used by the admin "open ticket" button,
// which pastes the id from a support email into this endpoint.
router.get('/admin/notes/:id', auth, async (req, res) => {
    try {
        const note = await Note.findOne({ id: req.params.id }, null, { lean: true }).exec();

        if (!note) {
            return res.status(404).json({ error: 'note not found' }).end();
        }

        res.status(200).json(note).end();
    } catch (e) {
        res.status(500).json({ error: e.message }).end();
    }
});

module.exports = router;
