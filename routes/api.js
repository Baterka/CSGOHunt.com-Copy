const express = require('express'),
    models = require('../models');
require('express-async-errors');

const router = express.Router();

/* API Routes */
router.post('/update-profile', models.Passport.isAuthenticated, async function (req, res, next) {
    res.json(await models.Api.updateProfile(req, res));
});

router.get('/get-inventory', models.Passport.isAuthenticated, async function (req, res, next) {
    res.json(await models.Api.getInventory(req.query.sid));
});

router.get('/duel-check', models.Passport.isAuthenticated, async function (req, res, next) {
    const provably = await models.Api.coinflipProvably(req.query);
    if (provably.error) {
        res.send(400, {error: provably.error});
    } else
        res.json(provably)
});

module.exports = router;
