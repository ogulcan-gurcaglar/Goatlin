const express = require('express');
const fs = require('fs');
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

router.get('/accounts/:username/notes/:note/attachment', auth, (req, res, next) => {
    const file = req.query.file;

    if (!file) {
        return res.status(400).json({ error: 'file is required' }).end();
    }

    const safeName = path.basename(file);
    if (safeName !== file || safeName.startsWith('.')) {
        return res.status(400).json({ error: 'invalid file name' }).end();
    }

    const attachmentsDir = path.resolve('/var/lib/goatlin/attachments', req.params.username, req.params.note);
    const target = path.resolve(attachmentsDir, safeName);

    if (target !== path.join(attachmentsDir, safeName) ||
        !target.startsWith(attachmentsDir + path.sep)) {
        return res.status(400).json({ error: 'invalid file name' }).end();
    }

    fs.readFile(target, (err, data) => {
        if (err) {
            return res.status(404).json({ error: err.message }).end();
        }
        res.status(200).type('application/octet-stream').send(data).end();
    });
});

module.exports = router;
