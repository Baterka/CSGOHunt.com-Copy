const express = require('express');
const router = express.Router();

const models = require('../models');

const Db = models.Db,
    Helper = models.Helper;

/* GET home page. */
router.get('/', async (req, res, next) => {
    let players = await Db.User.findAll({
        order: [['totalWon', 'DESC']],
        limit: 10
    });

    if (!players)
        players = [];

    for (let i in players) {
        players[i].avatar = Helper.User.buildAvatar(players[i].avatar)
    }

    res.locals.players = players;

    res.render('leaderboard', {});
});

router.get('/coinflip', async (req, res, next) => {
    let players = await Db.User.findAll({
        order: [['coinflipTotalWon', 'DESC']],
        limit: 10
    });

    if (!players)
        players = [];

    for (let i in players) {
        players[i].avatar = Helper.User.buildAvatar(players[i].avatar)
    }

    res.locals.players = players;

    res.render('coinflip-leaderboard', {});
});

module.exports = router;
