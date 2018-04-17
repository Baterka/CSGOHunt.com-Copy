const express = require('express'),
    config = require('../config'),
    models = require('../models');

const Db = models.Db,
    Log = models.Log,
    Helper = models.Helper,
    Passport = models.Passport;

const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.locals.page.title = "Coinflip";
    res.render('coinflip', {});
});

router.get('/history', Passport.isAuthenticated, async (req, res, next) => {
    //Rounds
    let rounds = await Db.CoinflipRound.findAll({
        where: {
            [Db.Op.or]: [
                Db.sequelize.fn('JSON_CONTAINS', Db.sequelize.col('creator'), '{"steam_id" : "' + res.locals.user.steamid + '"}', '$.user'),
                Db.sequelize.fn('JSON_CONTAINS', Db.sequelize.col('joiner'), '{"steam_id" : "' + res.locals.user.steamid + '"}', '$.user')
            ],
            status: 3
        },
        attributes: [
            "roundID",
            "status",
            "winnerID",
            "updatedAt",
            "creator",
            "joiner",
            [Db.sequelize.fn('JSON_VALUE', Db.sequelize.col('hashes'), '$.pin'), 'pin'],
            [Db.sequelize.fn('JSON_VALUE', Db.sequelize.col('creator'), '$.value'), 'cValue']
        ],
        order: [['updatedAt', 'DESC']]
    });
    res.locals.rounds = [];

    for (let round of rounds) {
        round.joiner = JSON.parse(round.joiner);
        res.locals.rounds.push({
            roundID: round.roundID,
            status: Helper.coinflipRoundStatus(round.status),
            pin: (round.winnerID === res.locals.user.steamid ? round.dataValues.pin : "-"),
            won: (round.winnerID === res.locals.user.steamid),
            updatedAt: round.updatedAt,
            totalValue: Helper.toUSD(parseInt(round.dataValues.cValue) + (round.joiner.value ? parseInt(round.joiner.value) : 0))
        });
    }
    res.locals.page.title = "Coinflip History";
    res.render('coinflip-history');
});

router.get('/details/:rid([a-f0-9]{24})', Passport.isAuthenticated, async (req, res, next) => {
    //Rounds
    let round = await await Db.CoinflipRound.findOne({
        where: {
            roundID: req.params.rid,
            status: 3
        }
    });

    if (!round)
        next();

    // Parsed from database
    round.hashes = JSON.parse(round.hashes);
    round.creator = JSON.parse(round.creator);
    round.joiner = JSON.parse(round.joiner);

    round.totalValue = Helper.toUSD(parseInt(round.creator.value) + parseInt(round.joiner.value));

    round.winner = (round.creator.user.steam_id === round.winnerID ? round.creator.user.name : round.joiner.user.name)

    res.locals.round = round;
    res.locals.page.title = "Coinflip Round Detail";
    res.render('coinflip-details');
});

module.exports = router;
