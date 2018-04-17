const express = require('express'),
    config = require('../config'),
    models = require('../models');

const Db = models.Db,
    Log = models.Log,
    Helper = models.Helper,
    Passport = models.Passport;

const router = express.Router();

router.get('/', function (req, res) {
    res.locals.page.title = "CS:GO Jackpot site";
    res.render('jackpot');
});

router.get('/jackpot/deposit', Passport.isAuthenticated, function (req, res) {
    let bots = config.steam.bots;
    let random = Helper.Generate.randomNum(0, Object.keys(bots).length - 1);
    res.redirect(bots[random].tradelink);
});

router.get('/jackpot/history', Passport.isAuthenticated, async (req, res) => {
        //Offers
        let offers = await await Db.Offer.findAll({
            where: {
                partner: res.locals.user.steamid,
                currentState: {
                    [Db.Op.ne]: -1
                }
            },
            attributes: ["offerID", "currentState", "message", "totalValue"],
            order: [['updatedAt', 'DESC']]
        });
        res.locals.offers = [];
        offers.forEach(offer => {
            res.locals.offers.push({
                offerID: offer.offerID,
                status: Helper.Steam.ETradeOfferState(offer.currentState),
                message: offer.message,
                value: (offer.totalValue !== -1 ? Helper.toUSD(offer.totalValue) : "-")
            });
        });

        //Rounds
        let rounds = await await Db.JackpotRound.findAll({
            where: Db.sequelize.fn('JSON_CONTAINS_PATH', Db.sequelize.col('players'), 'all', '$.' + res.locals.user.steamid),
            attributes: [
                "roundID",
                "status",
                "winnerSteamID",
                [Db.sequelize.fn('JSON_EXTRACT', Db.sequelize.col('bets'), '$[*].items[*].price'), 'prices'],
                [Db.sequelize.fn('JSON_VALUE', Db.sequelize.col('hashes'), '$.pin'), 'pin']
            ],
            order: [['updatedAt', 'DESC']]
        });
        res.locals.rounds = [];
        for (let round of rounds) {
            round.dataValues.prices = JSON.parse(round.dataValues.prices);
            res.locals.rounds.push({
                roundID: round.roundID,
                status: Helper.roundStatus(round.status),
                pin: (round.winnerSteamID === res.locals.user.steamid ? round.dataValues.pin : "-"),
                won: (round.winnerSteamID === res.locals.user.steamid),
                pot: Helper.toUSD(Helper.sumArray(round.dataValues.prices)),
            });
        }


        res.locals.page.title = "Jackpot History";
        res.render('jackpot-history');
    }
);

router.get('/jackpot/details/:rid([a-f0-9]{24})', Passport.isAuthenticated, async (req, res, next) => {
    //Rounds
    let round = await await Db.JackpotRound.findOne({
        where: {
            roundID: req.params.rid,
            status: 3
        }
    });

    if (!round)
        next();

    // Parsed from database
    round.hashes = JSON.parse(round.hashes);
    round.players = JSON.parse(round.players);
    round.bets = JSON.parse(round.bets);

    //Will be computed
    round.items = [];
    round.itemsPlaced = [];
    round.totalValue = 0;

    let betValues = {};
    for (let bet of round.bets) {

        for (let item of bet.items) {
            round.totalValue += item.price;

            if (betValues[item.from_steamID])
                betValues[item.from_steamID] += item.price;
            else
                betValues[item.from_steamID] = item.price;

            if (item.from_steamID === res.locals.user.steamid) {
                item.avatar = Helper.Item.buildImageURL(item.classid);
                item.price = Helper.toUSD(item.price);
                round.itemsPlaced.push(item);
            }
        }
    }

    let pKeys = Object.keys(round.players);
    for (let i = 0, len = pKeys.length; i < len; i++) {
        let percent = ((betValues[pKeys[i]] / round.totalValue) * 100).toFixed(2);
        round.players[pKeys[i]].probability = {
            percent,
            value: Helper.toUSD(betValues[pKeys[i]])
        }
    }

    round.winnerValue = Helper.toUSD(round.totalValue - round.winnerFee);
    round.totalValue = Helper.toUSD(round.totalValue);

    res.locals.round = round;
    res.locals.page.title = "Round Detail";
    res.render('jackpot-details');
});

module.exports = router;
