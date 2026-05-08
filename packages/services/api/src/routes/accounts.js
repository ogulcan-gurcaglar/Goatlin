const express = require('express');
const auth = require('../middleware/auth');
const Account = require('../models/account');
const Note = require('../models/note');

const router = express.Router();

// Recursively merge `patch` into `target`. The mobile client sends partial
// preference updates (only the keys the user changed) and we want to keep
// any existing keys the patch didn't mention, including nested ones.
function mergePreferences(target, patch) {
    for (const key in patch) {
        const value = patch[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            mergePreferences(target[key], value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

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

router.patch('/accounts/:username/preferences', auth, async (req, res) => {
    try {
        const account = await Account.findOne({ email: req.params.username }).exec();

        if (account === null) {
            return res.status(404).json({ error: 'account not found' }).end();
        }

        const current = account.preferences || {};
        const merged = mergePreferences(current, req.body || {});

        account.preferences = merged;
        account.markModified('preferences');
        await account.save();

        res.status(200).json(account.preferences).end();
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update preferences' }).end();
    }
});

module.exports = router;
