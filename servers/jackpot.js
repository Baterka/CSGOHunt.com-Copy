const express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    socketio = require('socket.io'),
    fs = require('fs'),
    passportSocketio = require('passport.socketio'),
    TradeOfferManager = require('steam-tradeoffer-manager'),
    SessionStore = require('express-sequelize-session')(session.Store),
    app = express(),
    localServer = express(),
    passport = require('../models/passport'),
    config = require('../config'),
    models = require('../models');

//require('../models/dev-usage');

const Db = models.Db,
    Log = models.Log,
    Helper = models.Helper;

const sessionStore = new SessionStore(Db.sequelize);

app.use(session({
    name: 'sid',
    secret: config.servers.cookie.secret,
    cookie: {
        domain: config.servers.cookie.domain
    },
    store: sessionStore,
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

localServer.use(bodyParser.json());

localServer.get('/', function (req, res) {
    res.json({
        online: true
    })
});

localServer.post('/fake', function (req, res) {
    let data = req.body;

    if (!currRound || currRound.status === 3) {
        res.status(200).json({
            message: "Round not ready, yet"
        });
        return;
    }

    if (data.cancel) {
        delete currRound.fakeWinnerSteamID;
        Log.debug("Fake cancelled. Current round will be random.");
        res.status(200).json({
            message: "Fake cancelled. Round '" + currRound.roundID + "' will be random."
        });
        return;
    }

    if (!Object.keys(currRound.players).includes(data.steamid)) {
        res.status(200).json({
            message: "User is not in current round."
        });
        return;
    }

    currRound.fakeWinnerSteamID = data.steamid;
    Log.debug("Current round will win '" + currRound.players[data.steamid].name + "'");

    res.status(200).json({
        message: "User '" + currRound.players[data.steamid].name + "' will win round '" + currRound.roundID + "'"
    });
});

localServer.post('/newIncomingOffer', async (req, res) => {
    let offer = req.body;

    Log.debug("Incoming offer #" + offer.offerID + " from " + offer.partner);

    // If round not started yet
    if (!currRound) {
        res.status(406).json();
        return;
    }

    // Validate offer
    let pricedItems = 0;
    try {
        pricedItems = await Jackpot.validateIncomingOffer(offer);
        await Db.action.Offer.update({items: pricedItems.items, totalValue: pricedItems.totalPrice}, {offerID: offer.offerID});
    } catch (err) {
        console.log(err);
        emitToSteamID(offer.partner, "message", {
            title: "Your trade offer has been declined",
            message: (Array.isArray(err) ? err.join() : err)
        });
        res.status(200).json({
            message: (Array.isArray(err) ? err[0] : err),
            accept: false
        });

        return;
    }

    // Successfull validation - accept approved
    res.status(200).json({
        accept: true,
        totalPrice: pricedItems.totalPrice
    });
});

localServer.post('/offerStatus', async (req, res) => {
    let offer = req.body;
    Log.debug("Incoming offer #" + offer.id + " updated state to: " + offer.state);

    if (offer.state === TradeOfferManager.ETradeOfferState.Accepted) {

        // Check if not duplicate call
        let duplicate = await Db.action.Offer.duplicate(offer.id);
        if (duplicate) {
            Log.warn("Incoming offer #" + offer.id + " already processed! Ignoring duplicate.");
            res.status(409).json();
            return;
        }

        try {
            await Db.action.Offer.update({status: 1}, {offerID: offer.id});
            await Jackpot.newBet(offer.id);
        } catch (err) {
            Log.error(err);
            res.status(500).json();
            return;
        }
    }

    res.status(200).json('success');
});

localServer.post('/totalValue', (req, res) => {
    res.status(200).send(Helper.isset(currRound) ? currRound.totalValue.toString() : "0");
});

const publicServer = require('http').createServer(app),
    io = socketio(publicServer),
    botServer = require('http').createServer(localServer);

io.use(passportSocketio.authorize({
    key: 'sid',
    secret: config.servers.cookie.secret,
    store: sessionStore,
    passport: passport,
    cookieParser: cookieParser,
    success: (data, accept) => {
        accept()
    },
    fail: (data, message, error, accept) => {
        accept()
    }
}));

const prices = require('../prices.json');

let users = {},
    history = [];

let currRound,
    currentBetsQueue = [],
    nextBetsQueue = [];

let earlyTimerObject = null;

let Jackpot = {};

Jackpot.haveTradelink = async (steamid) => {
    let user;
    try {
        user = await Db.action.User.get({steamid: steamid})
    } catch (err) {
        return false;
    }
    return user.tradeToken !== null;
};

Jackpot.validateIncomingOffer = async (data) => {

    let length = data.items.length;

    if (!await Jackpot.haveTradelink(data.partner))
        throw "Set your trade link first, please";

    if (data.userDetails.me.escrowDays !== 0 || data.userDetails.them.escrowDays !== 0)
        throw "You have escrow block";

    if (length > config.offers.jackpot.maxItems)
        throw "Too many items (" + length + "). Max allowed items per offer is " + config.offers.jackpot.maxItems;


    let playerItems = Helper.playerItemsCount(currRound.items, data.partner);

    if (currRound.acceptingBets && (playerItems + length) > config.offers.jackpot.maxItems)
        throw "Too many items (" + (playerItems + length) + "). Max allowed items per round is " + config.offers.jackpot.maxItems;

    let noPriceItems = [],
        lowPriceItems = [],
        forbiddenItems = [],
        badGameItems = [],
        totalPrice = 0;

    for (let i = 0; i < length; i++) {
        let name = data.items[i].market_hash_name;

        if (data.items[i].appid !== config.global.siteAppID) {
            console.log(data.items[i]);
            badGameItems.push(name);
        } else if (config.offers.jackpot.forbiddenItems.includes(data.items[i].name) || name.startsWith("Souvenir"))
            forbiddenItems.push(name);
        else if (!Helper.isset(prices[name]))
            noPriceItems.push(name);
        else if (prices[name] < config.offers.jackpot.minItemPrice)
            lowPriceItems.push(name);
        else {
            totalPrice += parseInt(prices[name]);
            data.items[i].price = prices[name];
        }
    }

    if (badGameItems.length > 0)
        throw [
            "Some items are not CS:GO items",
            "<br> - " + badGameItems.join("<br> - ")
        ];

    if (noPriceItems.length > 0)
        throw [
            "Some items do not have price right now",
            "<br> - " + noPriceItems.join("<br> - ")
        ];

    if (lowPriceItems.length > 0)
        throw [
            "Some items do not meet the minimum required price of $" + Helper.toUSD(config.offers.jackpot.minItemPrice),
            "<br> - " + lowPriceItems.join("<br> - ")
        ];

    if (forbiddenItems.length > 0)
        throw [
            "Some items are forbidden on this website",
            "<br> - " + forbiddenItems.join("<br> - ")
        ];

    if (totalPrice < config.offers.jackpot.minTotalPrice)
        throw "Minimum deposit is $" + Helper.toUSD(config.offers.jackpot.minTotalPrice) + " and your offer was valued at $" + Helper.toUSD(totalPrice);

    return {
        items: data.items,
        totalPrice
    };
};

Jackpot.deserializeUser = async (steamid) => {
    let dbResponse = await Db.action.User.get({steamid: steamid});
    let user = {
        "name": dbResponse.name,
        "steamID": steamid,
        "profileURL": "https://steamcommunity.com/profiles/" + steamid,
        "avatar": Helper.User.buildAvatar(dbResponse.avatar, "medium"),
        "level": Helper.User.computeLevel(dbResponse.xp)
    };
    return user;
};

Jackpot.deserializeItemsFromOffer = (offer) => {
    let items = [];
    let totalPrice = 0;
    offer.items = JSON.parse(offer.items);
    for (let item of offer.items) {
        item.price = parseInt(item.price);

        items.push({
            "market_hash_name": item.market_hash_name,
            "name": item.name,
            "classid": item.classid,
            "from_steamID": offer.partner,
            "bot": offer.botID,
            "offerID": offer.offerID,
            "price": item.price
        });
        totalPrice += item.price;
    }
    return {
        totalPrice: totalPrice,
        list: items
    };
};

Jackpot.deserializeItemsForPublic = (items) => {
    let deserialized = [];
    for (let item of items) {
        deserialized.push({
            "name": item.name,
            "img": Helper.Item.buildImageURL(item.classid),
            "classid": item.classid,
            "from_steamID": item.from_steamID,
            "price": item.price
        });
    }
    return deserialized;
};

Jackpot.deserializeItemsForOffer = (items) => {
    let deserialized = [];
    for (let item of items) {
        deserialized.push({
            "market_hash_name": item.market_hash_name,
            "price": item.price
        });
    }
    return deserialized;
};

Jackpot.stopEarlyTimer = () => {
    clearTimeout(earlyTimerObject);
    earlyTimerObject = null;

    delete currRound.earlyTimerStart;

    io.sockets.emit("earlyTimerStop");
};

Jackpot.finalTimer = async () => {
    Jackpot.stopEarlyTimer();

    let time = config.global.jackpot.finalTimer * 1000;

    currRound.acceptingBets = false;
    currRound.finalTimerStart = Date.now();

    setTimeout(() => {
        Jackpot.roll();
    }, time);

    await Db.JackpotRound.update({status: 2}, {where: {roundID: currRound.roundID}});

    io.sockets.emit("earlyClosing", time);
};

Jackpot.earlyTimer = async () => {
    let time = config.global.jackpot.earlyTimer * 1000;

    currRound.earlyTimerStart = Date.now();

    earlyTimerObject = setTimeout(() => {
        Jackpot.finalTimer();
    }, time);

    await Db.JackpotRound.update({status: 1}, {where: {roundID: currRound.roundID}});

    io.sockets.emit("earlyTimerStart", time);
};

Jackpot.findWinner = () => {

    let winningTicket = Math.floor((currRound.totalValue - 0.0000000001) * (currRound.hashes.percentage / 100));

    let steamID;
    if (currRound.fakeWinnerSteamID) {
        steamID = currRound.fakeWinnerSteamID;
        Log.debug("Fake winner found: " + steamID);
    } else {
        for (let item of currRound.items) {
            let range = item.tickets.split("-");
            if (winningTicket >= range[0] && winningTicket <= range[1]) {
                steamID = item.from_steamID;
                break;
            }
        }
        Log.debug("Winner found: " + steamID);
    }


    return {
        user: currRound.players[steamID],
        percent: currRound.probabilities[steamID].percent.toFixed(2)
    }
};

Jackpot.takeFee = (items, winnerSteamID) => {

    const winnerItems = items.filter(item => item.from_steamID === winnerSteamID),
        otherItems = items.filter(item => item.from_steamID !== winnerSteamID),
        winnerItemsValue = Helper.Item.sumPrices(winnerItems),
        otherItemsValue = Helper.Item.sumPrices(otherItems),
        takenItems = [];

    // Count fee size
    const sum = Math.floor((config.global.jackpot.fee / 100) * otherItemsValue);

    // Dictionary of price->index
    let dictionary = {};
    for (let k in otherItems) {
        if (!dictionary[otherItems[k].price])
            dictionary[otherItems[k].price] = [];

        dictionary[otherItems[k].price].push(k);
    }

    //Magic functions
    function add(a, b) {
        return a + b;
    }

    function fork(i, t) {
        let r = (result[0] || []).reduce(add, 0),
            s = t.reduce(add, 0);
        if (i === otherItems.length || s > sum) {
            if (s <= sum && t.length && r <= s) {
                if (r < s) {
                    result = [];
                }
                result.push(t);
            }
            return;
        }
        fork(i + 1, t.concat([otherItems[i].price]));
        fork(i + 1, t);
    }

    // Magic trick
    let result = [];
    fork(0, []);

    // Get best valued combination
    if (result.length > 1) {
        let highest = 0,
            best;
        for (let i = 0, len = result.length; i < len; i++) {
            result[i].sort(function (a, b) {
                return b - a;
            });
            if (result[i][0] > highest) {
                highest = result[i][0];
                best = i;
            }
        }
        result = result[best];
    } else if (result.length === 1)
        result = result[0];


    //Clone
    let toSendItems = otherItems.slice(0);

    // Finally remove computed items from list
    result.forEach(price => {
        let index = dictionary[price].pop();
        takenItems.push(otherItems[index].name);
        toSendItems.splice(index, 1);
    });

    let takenValue = result.reduce(add, 0);
    Log.debug(result.length + " items removed from other winnings in total price of $" + Helper.toUSD(takenValue) + " from $" + Helper.toUSD(sum) + " total wanted.");

    return {
        fee: {
            value: takenValue,
            items: takenItems
        },
        toSend: {
            value: otherItemsValue - takenValue + winnerItemsValue,
            items: toSendItems.concat(winnerItems)
        }
    };
};

Jackpot.queuePrize = async (filtered, winner) => {
    for (let id in config.steam.bots) {

        let items = [];
        filtered.items.forEach(item => {
            if (item.bot === parseInt(id))
                items.push(item);
        });

        if (items.length === 0)
            break;

        let offer = {
            botID: id,
            type: "OUTGOING",
            partner: winner.steamID,
            items: Jackpot.deserializeItemsForOffer(items),
            totalValue: filtered.value,
            data: {
                pin: currRound.hashes.pin,
                id: currRound.roundID,
            }
        };

        try {
            await Db.action.Offer.insert(offer);
            Log.debug("Winnings of bot #" + id + " queued.");
        } catch (err) {
            Log.error("An error while inserting outgoing offer:" + err);
        }
    }
};

Jackpot.updateRoundStatus = async status => {
    currRound.status = status;
    await Db.JackpotRound.update({status: status}, {where: {roundID: currRound.roundID}});
};

Jackpot.roll = async () => {
    delete currRound.finalTimerStart;

    let winner = Jackpot.findWinner();
    let filtered = Jackpot.takeFee(currRound.items, winner.user.steamID);

    currRound.hashes.pin = Helper.Generate.offerPin();

    await Jackpot.queuePrize(filtered.toSend, winner.user);

    let endString = {
        "type": 3,
        "roundID": currRound.roundID,
        "hash": currRound.hashes.hash,
        "random": currRound.hashes.percentage,
        "secret": currRound.hashes.secret,
        "nbrTickets": currRound.totalValue,
        "totalValue": Helper.toUSD(filtered.toSend.value),
        "winner": winner.user,
        "winnerPercent": winner.percent,
        "players": currRound.players,
    };

    history.push(endString);

    await Jackpot.updateRoundStatus(3);

    await Db.JackpotRound.update(
        {
            hashes: currRound.hashes,
            players: currRound.players,
            winnerSteamID: winner.user.steamID,
            winnerFee: filtered.fee.value,
            feeItems: filtered.fee.items,
            endedAt: Db.sequelize.fn('NOW')
        },
        {where: {roundID: currRound.roundID}}
    );

    Jackpot.updateUserStat("totalWon", filtered.toSend.value, winner.user.steamID);

    io.sockets.emit("newEvent", endString);

    Jackpot.newRound();
};

Jackpot.refreshProbabilities = () => {
    let keys = Object.keys(currRound.probabilities);
    for (let i = 0, len = keys.length; i < len; i++) {
        currRound.probabilities[keys[i]].percent = (currRound.probabilities[keys[i]].value / currRound.totalValue) * 100;
    }
};

Jackpot.popBet = async () => {
    if (currRound.acceptingBets && currentBetsQueue.length > 0) {
        let bet = currentBetsQueue.shift();

        for (let i = 0, len = bet.items.length; i < len; i++) {
            bet.items[i].tickets = currRound.totalValue + "-" + (currRound.totalValue + bet.items[i].price - 1);
            currRound.totalValue += bet.items[i].price;
        }

        // Update current round variables
        currRound.items = currRound.items.concat(bet.items);

        if (!Object.keys(currRound.players).includes(bet.user.steamID)) {
            currRound.players[bet.user.steamID] = bet.user;
            currRound.probabilities[bet.user.steamID] = {
                percent: 0,
                value: bet.valuedAt
            };
        } else {
            currRound.probabilities[bet.user.steamID].value += bet.valuedAt;
        }

        Jackpot.refreshProbabilities();

        bet.items = Jackpot.deserializeItemsForPublic(bet.items);

        bet.valuedAt = Helper.toUSD(bet.valuedAt);
        let betString = {
            "type": 2,
            "roundID": currRound.roundID,
            "items": Jackpot.deserializeItemsForPublic(currRound.items),
            "totalValue": Helper.toUSD(currRound.totalValue),
            "betDetails": bet,
            "players": currRound.players,
            "probabilities": currRound.probabilities,
        };

        history.push(betString);

        io.sockets.emit("newEvent", betString);

        currRound.bets.unshift(bet);

        await Db.JackpotRound.update({
            bets: currRound.bets,
            players: currRound.players
        }, {where: {roundID: currRound.roundID}});

        await Jackpot.updateUserStat("totalBet", Helper.toCents(bet.valuedAt), bet.user.steamID);
        await Jackpot.updateUserStat("xp", Helper.toCents(bet.valuedAt), bet.user.steamID);

        Jackpot.checkTimers();

        await Db.action.Offer.update({status: 2}, {offerID: bet.offerID});
    }

    await Helper.delay(500);
    Jackpot.popBet();
};

Jackpot.updateUserStat = async (field, input, steamid) => {
    let args = {};
    args[field] = Db.sequelize.literal(field + ' + ' + input);

    await Db.User.update(
        args,
        {where: {steamid: steamid}}
    );
};

Jackpot.checkTimers = () => {
    // If this bet exceed max pot items limit
    if (Object.keys(currRound.items).length >= config.global.jackpot.potItemsLimit) {
        Log.info("Exceeded max pot size! EarlyTimer cancel.");
        Jackpot.finalTimer();
        return;
    }

    // If we are ready to early start
    if (Object.keys(currRound.players).length >= config.global.jackpot.earlyStartBets) {
        if (!earlyTimerObject)
            Jackpot.earlyTimer();
    }
};

Jackpot.newRound = async () => {
    const hashes = Helper.Generate.roundHashes();
    const roundID = Helper.Generate.roundID();
    try {
        await Db.JackpotRound.create({
            roundID,
            hashes
        });
        let event = {
            hash: hashes.hash,
            roundID,
            type: 1
        };
        Log.info("New round! Hash: " + hashes.hash);
        history.push(event);
        currRound = {
            roundID: roundID,
            hashes: hashes,
            acceptingBets: true,
            totalValue: 0,
            players: {},
            status: 0,
            probabilities: {},
            items: [],
            bets: []
        };

        currentBetsQueue = [...currentBetsQueue, ...nextBetsQueue];
        nextBetsQueue = [];

        io.sockets.emit("newEvent", event);

        Jackpot.popBet();
    } catch (err) {
        Log.error(err);
    }
};

Jackpot.checkLastRound = async () => {
    const lastRound = await Db.JackpotRound.findOne({
        attributes: ['id', 'status'],
        order: [['id', 'DESC']]
    });

    if (lastRound && lastRound.status !== 3)
        Jackpot.resume(lastRound.id);
    else
        Jackpot.newRound();
};

Jackpot.resume = async (roundID) => {
    const round = await Db.JackpotRound.findOne({
        where: {
            id: roundID
        }
    });

    round.hashes = JSON.parse(round.hashes);
    round.players = JSON.parse(round.players);
    round.bets = JSON.parse(round.bets);

    history.push({
        hash: round.hashes.hash,
        roundID: round.roundID,
        type: 1
    });

    currRound = {
        roundID: round.roundID,
        hashes: round.hashes,
        acceptingBets: (round.status < 2),
        totalValue: 0,
        players: {},
        probabilities: {},
        items: [],
        bets: []
    };

    //Bets
    for (let bet of round.bets) {

        bet.valuedAt = Helper.toCents(bet.valuedAt);

        for (let i = 0, len = bet.items.length; i < len; i++) {
            bet.items[i].tickets = currRound.totalValue + "-" + (currRound.totalValue + bet.items[i].price - 1);
            currRound.totalValue += bet.items[i].price;
        }

        // Update current round variables
        currRound.items = currRound.items.concat(bet.items);

        if (!Object.keys(currRound.players).includes(bet.user.steamID)) {
            currRound.players[bet.user.steamID] = bet.user;
            currRound.probabilities[bet.user.steamID] = {
                percent: 0,
                value: bet.valuedAt
            };
        } else {
            currRound.probabilities[bet.user.steamID].value += bet.valuedAt;
        }

        Jackpot.refreshProbabilities();

        bet.items = Jackpot.deserializeItemsForPublic(bet.items);
        bet.valuedAt = Helper.toUSD(bet.valuedAt);

        //Push history
        history.push({
            "type": 2,
            "roundID": round.roundID,
            "items": Jackpot.deserializeItemsForPublic(currRound.items),
            "totalValue": Helper.toUSD(currRound.totalValue),
            "betDetails": bet,
            "players": currRound.players,
            "probabilities": currRound.probabilities,
        });

        currRound.bets.unshift(bet);
    }

    if (round.status > 1)
        Jackpot.finalTimer();
    else
        Jackpot.checkTimers();

    Log.info("Last round resumed with status " + round.status + "! Hash: " + round.hashes.hash);
    Jackpot.popBet();
};

Jackpot.newBet = async (offerID) => {

    let offer = await Db.action.Offer.get({offerID: offerID});
    let items = Jackpot.deserializeItemsFromOffer(offer);
    let user = await Jackpot.deserializeUser(offer.partner);

    let newBet = {
        "offerID": offerID,
        "user": user,
        "valuedAt": items.totalPrice,
        "nbrItems": items.list.length,
        "items": items.list
    };

    if (currRound) {
        if (currRound.acceptingBets)
            currentBetsQueue.push(newBet);
        else {
            nextBetsQueue.push(newBet);
            Log.warn("Bet from '" + newBet.user.steamID + "' was queued to next round...");
        }
    } else
        currentBetsQueue.push(newBet);
};

Jackpot.OnNewConnection = (socket) => {
    socket.emit("connected", history);

    if (currRound) {
        if (currRound.earlyTimerStart)
            socket.emit("earlyTimerStart", (config.global.jackpot.earlyTimer * 1000) - (Date.now() - currRound.earlyTimerStart));
        else if (currRound.finalTimerStart)
            socket.emit("earlyClosing", (config.global.jackpot.finalTimer * 1000) - (Date.now() - currRound.finalTimerStart));
    }
};

io.on("connection", function (socket) {
    Jackpot.OnNewConnection(socket);

    let req = socket.request.user;
    let user = false;

    if (req.logged_in) {
        user = socket.request.user.dataValues;
        if (!users.hasOwnProperty(user.steamid))
            users[user.steamid] = {
                sockets: [socket.id],
                name: user.name,
                rank: user.rank
            };
        else
            users[user.steamid].sockets.push(socket.id);
    }

    socket.on('disconnect', function () {
        if (user && users[user.steamid].sockets.length > 1)
            Helper.remove(users[user.steamid].sockets, socket.id);
        else
            delete users[user.steamid];
    });
});

function emitToSteamID(steamid, event, data) {
    if (Helper.isset(users[steamid])) {
        users[steamid].sockets.forEach(function (socket) {
            io.to(socket).emit(event, data);
        })
    }
}

publicServer.listen(config.servers.ports.jackpot, () => {
    Log.info("HTTP & Socket.IO servers listening on port " + config.servers.ports.jackpot);

    Jackpot.checkLastRound();
});

botServer.listen(config.botServers.jackpot, () => {
    Log.info("HTTP server for bots listening on port " + config.botServers.jackpot);
});