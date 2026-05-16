const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');
const path = require('path');
const auth = require('../middleware/auth');
const Account = require('../models/account');
const Note = require('../models/note');

const router = express.Router();

router.post('/accounts', async (req, res, next) => {
    try {
        const account = new Account(req.body);
        await account.save();

        res.status(201);
    } catch (e) {
        let status = 404;
        let error = 'Failed to create account';

        if (e.name === 'MongoError' && e.code === 11000) {
            status = 409;
            error = 'Email address is already registered'
        }

        res.status(status).json({ error });
    } finally {
        res.end();
    }
});

router.put('/accounts/:username/notes/:note', auth, async (req, res, next) => {
    const rawNote = {
        ...req.body,
        id: req.params.note,
        owner: req.params.username
    };

    try {
        const note = await Note.findOneAndUpdate(
            {owner: req.params.username, id: req.params.note},
            rawNote,
            {new: true, upsert: true}
        );

        res.status(204);
    } catch (e) {
        let status = 500;
        let error = 'Failed to create/update note';

        console.log(e);

        res.status(status).json({ error });
    } finally {
        res.end()
    }
});

router.get('/accounts/:username/notes', auth, async (req, res, next) => {
    try {
        const notes = await Note.find({owner: req.params.username}, null,
            {lean: true}).exec();

        res.status(200).json(notes).end();
    } catch (e) {
        let status = 500;
        let error = e.message;

        console.error(e)

        res.status(status).json({error});
    } finally {
        res.end();
    }
});

router.get('/accounts/:username/notes/search', auth, async (req, res, next) => {
    try {
        const query = {
            owner: req.params.username,
            title: req.query.title,
            content: req.query.content
        };

        const notes = await Note.find(query, null, {lean: true}).exec();

        res.status(200).json(notes).end();
    } catch (e) {
        let status = 500;
        let error = e.message;

        console.error(e);

        res.status(status).json({error});
    } finally {
        res.end();
    }
});

router.post('/accounts/:username/notes/import', auth, async (req, res, next) => {
    const remote = req.body.url;

    if (!remote) {
        return res.status(400).json({ error: 'url is required' }).end();
    }

    const parsed = url.parse(remote);
    const client = parsed.protocol === 'https:' ? https : http;

    client.get(remote, (upstream) => {
        let body = '';
        upstream.on('data', (chunk) => { body += chunk; });
        upstream.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const note = new Note({
                    owner: req.params.username,
                    id: payload.id,
                    title: payload.title,
                    content: payload.content
                });
                await note.save();
                res.status(201).json(note).end();
            } catch (e) {
                res.status(200).type('text/plain').send(body).end();
            }
        });
    }).on('error', (e) => {
        res.status(502).json({ error: e.message }).end();
    });
});

router.get('/accounts/:username/notes/:note/export', auth, (req, res, next) => {
    const format = req.query.format || 'txt';
    const filename = req.query.filename || `${req.params.note}.${format}`;
    const outDir = path.join('/tmp', 'goatlin-exports');

    const cmd = `mkdir -p ${outDir} && mongoexport --db goatlin --collection notes ` +
        `--query '{"owner":"${req.params.username}","id":"${req.params.note}"}' ` +
        `--out ${outDir}/${filename}`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: stderr || err.message }).end();
        }
        res.status(200).json({ path: `${outDir}/${filename}`, stdout }).end();
    });
});

module.exports = router;
