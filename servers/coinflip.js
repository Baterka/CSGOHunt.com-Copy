const express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    socketio = require('socket.io'),
    axios = require("axios"),
    moment = require("moment"),
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
});

localServer.post('/onCreateResult', async (req, res) => {
    let result = req.body;
    Log.debug("Incoming create result info for " + result.steamid);
    if (result.error) {
        emitToSteamID(result.steamid, "onCreateResult", {
            error: result.error
        })
    } else {
        emitToSteamID(result.steamid, "onCreateResult", {
            pin: result.pin,
            tradeofferid: result.id
        })
    }

    res.status(200).json('ok');
});

localServer.post('/updateRound', async (req, res) => {
    let data = req.body;
    Log.debug("Offer update for round recieved.");
    Coinflip.updateRound(data);
    res.status(200).json('ok');
});

localServer.post('/totalValue', async (req, res) => {
    let rounds = await Db.CoinflipRound.findAll({
        where: {
            status: {
                [Db.Op.lt]: 3
            }
        },
        attributes: ['creator', 'joiner'],
        raw: true
    });
    let total = 0;
    for (let round of rounds) {
        round.creator = JSON.parse(round.creator);
        round.joiner = JSON.parse(round.joiner);

        total += round.creator.value;

        if (round.joiner.value)
            total += round.joiner.value;
    }

    res.status(200).send(total.toString());
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

let Coinflip = {};

let lastInventoryFetch = 0;
Coinflip.fetchUserInventory = async steamid => {
    let ret = {};

    if (!Helper.isSteamID64(steamid))
        return ret;

    if (lastInventoryFetch > Date.now()) {
        throw "Steam is busy. Try again later...";
    }

    try {
        const res = await axios.get("http://steamcommunity.com/inventory/" + steamid + "/" + config.global.siteAppID + "/2?l=english&count=1000");

        lastInventoryFetch = Date.now() + (config.steam.inventoryFetchLimiter * 1000);

        const data = res.data;
        let inventory = {};
        const descriptions = {};

        for (let i in data.descriptions) {
            let description = data.descriptions[i];
            descriptions[description.classid] = description;
        }

        for (let i in data.assets) {
            let asset = data.assets[i];
            let item = descriptions[asset.classid];
            let price = prices[item.market_hash_name];

            inventory[asset.assetid] = Object.assign(asset, item);
            inventory[asset.assetid]['price'] = (price ? price : false);
        }

        return inventory;
    } catch (err) {
        Log.error("An error occurred while fetching steam inventory: " + err);
        throw "An error occurred while fetching your inventory. Try again later...";
    }
};

Coinflip.haveTradelink = async (steamid) => {
    let user;
    try {
        user = await Db.action.User.get({steamid: steamid})
    } catch (err) {
        return false;
    }
    return user.tradeToken !== null;
};

Coinflip.validateBet = async (user, data, join) => {

    if (!data.asset_ids || !data.seed.length)
        throw "Invalid seed length";

    if (!/^[a-zA-Z0-9]*$/ig.test(data.seed))
        throw "Invalid seed characters: only A-Z and numbers are allowed";

    if (!data.asset_ids || !data.asset_ids.length)
        throw "No items selected";

    if (!await Coinflip.haveTradelink(user.steamid))
        throw "Set your trade link first, please";

    const length = data.asset_ids.length;

    if (length > config.offers.coinflip.maxItems)
        throw "Too many items (" + length + "). Max allowed items is " + config.offers.coinflip.maxItems;


    let items;
    try {
        items = await Coinflip.fetchUserInventory(user.steamid);
    } catch (err) {
        throw err;
    }


    let notFoundItems = [],
        noPriceItems = [],
        lowPriceItems = [],
        forbiddenItems = [],
        badGameItems = [],
        totalPrice = 0;

    data.items = [];

    for (let i of data.asset_ids) {
        if (items[i]) {
            let name = items[i].market_hash_name;

            if (config.offers.coinflip.forbiddenItems.includes(items[i].name) || name.startsWith("Souvenir"))
                forbiddenItems.push(name);
            else if (!items[i].price)
                noPriceItems.push(name);
            else if (items[i].price < config.offers.coinflip.minItemPrice)
                lowPriceItems.push(name);
            else {
                totalPrice += parseInt(items[i].price);
                data.items.push(items[i]);
            }
        } else
            notFoundItems.push(i);
    }

    if (notFoundItems.length > 0)
        throw "Some items are not in your inventory (" + notFoundItems.join(", ") + ")";

    if (badGameItems.length > 0)
        throw "Some items are not items from right game<br> - " + badGameItems.join("<br> - ");

    if (noPriceItems.length > 0)
        throw "Some items do not have price right now<br> - " + noPriceItems.join("<br> - ");

    if (lowPriceItems.length > 0)
        throw "Some items do not meet the minimum required price of $" + Helper.toUSD(config.offers.coinflip.minItemPrice) + "<br> - " + lowPriceItems.join("<br> - ");

    if (forbiddenItems.length > 0)
        throw "Some items are forbidden on this website<br> - " + forbiddenItems.join("<br> - ");

    if (totalPrice < config.offers.coinflip.minTotalPrice)
        throw "The minimum bet value is $" + Helper.toUSD(config.offers.coinflip.minTotalPrice) + " and your items were valued at $" + Helper.toUSD(totalPrice);

    if (join) {
        if (!data.round_id)
            throw "Invalid round ID";

        let dbRound;
        try {
            dbRound = await Db.CoinflipRound.findOne({
                where: {
                    roundID: data.round_id,
                    status: 1
                }
            });

            if (!dbRound)
                throw "Selected round not exists or joined already";

            dbRound.creator = JSON.parse(dbRound.creator);
        } catch (err) {
            throw "Invalid round ID";
        }

        if (data.side === "t")
            throw "You can not choose side when joining";

        const minJoinPrice = (dbRound.creator.value * (1 - 0.10)).toFixed(2);
        const maxJoinPrice = (dbRound.creator.value * (1 + 0.10)).toFixed(2);

        if (totalPrice < minJoinPrice || totalPrice > maxJoinPrice)
            throw "You must choose items between $" + Helper.toUSD(minJoinPrice) + "-$" + Helper.toUSD(maxJoinPrice) + " and you selected $" + Helper.toUSD(totalPrice)
    }

    return {
        items: data.items,
        totalPrice
    };
};

Coinflip.createOffer = async (user, data, join) => {

    let error = false;

    let items;
    try {
        items = await Coinflip.validateBet(user, data, join)
    } catch (err) {
        error = err;
    }

    if (!error) {
        try {
            await Coinflip.queueBet(user.steamid, items, data.side, data.seed, data.round_id);
        } catch (err) {
            error = err.toString();
        }
    }

    if (error) {
        emitToSteamID(user.steamid, "onCreateResult", {
            error: error
        })
    }
};

Coinflip.deserializeItemsForOffer = (items) => {
    let deserialized = [];
    for (let item of items) {
        deserialized.push({
            "assetid": item.assetid,
            "market_hash_name": item.market_hash_name,
            "name": item.name,
            "classid": item.classid,
            "price": parseInt(item.price)
        });
    }
    return deserialized;
};

Coinflip.deserializeItemsForWinOffer = (items) => {
    let deserialized = [];
    for (let item of items) {
        deserialized.push({
            "market_hash_name": item.market_hash_name,
            "price": item.price
        });
    }
    return deserialized;
};


Coinflip.queueBet = async (steamid, items, side, seed, roundID = false) => {
    let id = 1;
    let pin = Helper.Generate.offerPin();
    let offer = {
        botID: id,
        type: "OUTGOING",
        partner: steamid,
        items: Coinflip.deserializeItemsForOffer(items.items),
        totalValue: items.totalPrice,
        data: {
            bet: true,
            player: (!roundID ? 1 : 2),
            pin,
            seed
        }
    };

    if (!roundID)
        offer.data.side = side;
    else
        offer.data.round_id = roundID;

    try {
        await Db.CoinflipOffer.create(offer);
        Log.debug("Bet request offer for bot #" + id + " queued.");
    } catch (err) {
        Log.error("An error while inserting outgoing offer:" + err);
        throw "An error while sending offer. Try again..."
    }
};

Coinflip.getRounds = async () => {
    const dbRounds = await Db.CoinflipRound.findAll({raw: true});

    const rounds = [];

    for (let dbRound of dbRounds) {
        rounds.push(Coinflip.serializeRound(dbRound));
    }

    return rounds;
};

Coinflip.getRound = async roundID => {
    const dbRound = await Db.CoinflipRound.findOne({
        where: {roundID: roundID},
        raw: true
    });

    if (!Helper.isset(dbRound))
        return false;
    else
        return Coinflip.serializeRound(dbRound);
};

Coinflip.watchRound = async (socket, roundID) => {
    socket.emit("showDetails", await Coinflip.getRound(roundID));
};

Coinflip.serializeRound = (dbRound, raw = true) => {
    if (raw) {
        dbRound.creator = JSON.parse(dbRound.creator);
        dbRound.hashes = JSON.parse(dbRound.hashes);
    }
    let cValue = dbRound.creator.value;
    let round = {
        "c_items": dbRound.creator.items,
        "c_value": parseInt(cValue),
        "created_by": dbRound.creator.user,
        "created_on": moment(dbRound.createdAt).toISOString(),
        "now": Date.now(),
        "round_id": dbRound.roundID,
        "server_hash": dbRound.hashes.hash,
        "status": dbRound.status
    };

    if (dbRound.status > 1 && Helper.isset(dbRound.joiner)) {
        if (raw)
            dbRound.joiner = JSON.parse(dbRound.joiner);
        let jValue = dbRound.joiner.value;
        round = Object.assign(round, {
            "j_items": dbRound.joiner.items,
            "j_join_on": dbRound.joiner.joinedAt,
            "j_value": parseInt(jValue),
            "joined_by": dbRound.joiner.user
        });
        if (dbRound.status > 2 && dbRound.winnerID) {
            round.winner = dbRound.winnerID;
            round.end_date = dbRound.updatedAt;
            round.roll = dbRound.hashes.percent;
        }

    }

    return round;
};

Coinflip.createRound = async (data) => {
    let hashes = Helper.Generate.coinflipRoundHashes();
    const roundID = Helper.Generate.roundID();
    const creator = {
        "user": await Coinflip.deserializeUser(data.dbOffer.partner),
        "items": Coinflip.serializeItemsForRound(data.dbOffer.items),
        "value": data.dbOffer.totalValue
    };
    creator.user["side"] = data.dbOffer.data.side;
    hashes.c_seed = data.dbOffer.data.seed;

    const newRound = {
        roundID,
        hashes,
        creator,
        status: 1
    };
    try {
        await Db.CoinflipRound.create(newRound);
    } catch (err) {
        Log.error(err);
    }

    io.sockets.emit("newRound", await Coinflip.serializeRound(newRound, false))
};

Coinflip.deserializeUser = async (steamid) => {
    let dbResponse = await Db.action.User.get({steamid: steamid});
    let user = {
        "name": dbResponse.name,
        "steam_id": steamid,
        "avatar": Helper.User.buildAvatar(dbResponse.avatar, "medium"),
        "level": Helper.User.computeLevel(dbResponse.xp)
    };
    return user;
};

Coinflip.serializeItemsForRound = (items) => {
    let deserialized = [];
    for (let item of items) {
        deserialized.push({
            "id": item.assetid,
            "name": item.name,
            "market_hash_name": item.market_hash_name,
            "classid": item.classid,
            "img": Helper.Item.buildImageURL(item.classid),
            "price": item.price
        });
    }
    return deserialized;
};

Coinflip.joinRound = async data => {
    const joiner = {
        "user": await Coinflip.deserializeUser(data.dbOffer.partner),
        "items": Coinflip.serializeItemsForRound(data.dbOffer.items),
        "value": data.dbOffer.totalValue,
        "joinedAt": Date.now()
    };
    let round;
    try {
        round = await Db.CoinflipRound.findOne({
            where: {roundID: data.dbOffer.data.round_id},
            raw: true
        });


        round.hashes = JSON.parse(round.hashes);
        round.hashes['j_seed'] = data.dbOffer.data.seed;
        round.joiner = joiner;
        round.status = 2;

        round.creator = JSON.parse(round.creator);

        await Db.CoinflipRound.update(round, {
            where: {roundID: data.dbOffer.data.round_id}
        });

    } catch (err) {
        Log.error(err);
    }

    io.sockets.emit("roundJoiningP1", await Coinflip.serializeRound(round, false))
};

Coinflip.takeFee = (items) => {

    const otherItems = items,
        otherItemsValue = Helper.Item.sumPrices(otherItems),
        takenItems = [];

    // Count fee size
    const sum = Math.floor((config.global.coinflip.fee / 100) * otherItemsValue);

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
            value: otherItemsValue - takenValue,
            items: toSendItems
        }
    };
};

Coinflip.queuePrize = async (roundID, filtered, winnerID) => {
    let id = 1;
    let offer = {
        botID: id,
        type: "OUTGOING",
        partner: winnerID,
        items: Coinflip.deserializeItemsForWinOffer(filtered.items),
        totalValue: filtered.value,
        data: {
            pin: Helper.Generate.offerPin(),
            id: roundID,
        }
    };

    try {
        await Db.CoinflipOffer.create(offer);
        Log.debug("Winnings from round #" + roundID + " queued.");
    } catch (err) {
        Log.error("An error while inserting outgoing offer:" + err);
    }
};

Coinflip.finishRound = async roundID => {
    let round;
    try {
        round = await Db.CoinflipRound.findOne({
            where: {roundID: roundID},
            raw: true
        });

        round.hashes = JSON.parse(round.hashes);
        round.creator = JSON.parse(round.creator);
        round.joiner = JSON.parse(round.joiner);

        const percent = Helper.Generate.coinflipPercent(round.hashes.seed + round.hashes.c_seed + round.hashes.j_seed);

        const total = round.creator.value + round.joiner.value;
        const cPercent = (round.creator.value * 100 / total).toFixed(8);

        if ((round.creator.user.side === "ct" && percent <= cPercent) || (round.creator.user.side === "t" && percent >= cPercent))
            round.winnerID = round.creator.user.steam_id;
        else
            round.winnerID = round.joiner.user.steam_id;

        round.hashes.percent = percent;
        round.status = 3;

        await Db.CoinflipRound.update(round, {
            where: {roundID: round.roundID}
        });

        let filtered = Coinflip.takeFee(round.creator.items.concat(round.joiner.items));
        await Coinflip.queuePrize(round.roundID, filtered.toSend, round.winnerID);


        await Coinflip.updateUserStat("totalBet", round.creator.value, round.creator.user.steam_id);
        await Coinflip.updateUserStat("xp", round.creator.value, round.creator.user.steam_id);

        await Coinflip.updateUserStat("totalBet", round.joiner.value, round.joiner.user.steam_id);
        await Coinflip.updateUserStat("xp", round.joiner.value, round.joiner.user.steam_id);

        await Coinflip.updateUserStat("totalWon", filtered.toSend.value, round.winnerID);

        io.sockets.emit("roundEnd", {
            created_by: round.creator.user,
            joined_by: round.joiner.user,
            roll: percent,
            round_id: round.roundID,
            winner_id: round.winnerID
        })

    } catch (err) {
        Log.error(err);
    }
};

Coinflip.joinerCancelled = async data => {
    try {
        await Db.CoinflipRound.update({
            joiner: {},
            status: 1
        }, {
            where: {roundID: data.dbOffer.data.round_id}
        });

    } catch (err) {
        Log.error(err);
    }

    io.sockets.emit("roundJoiningP0", data.dbOffer.data.round_id)
};

Coinflip.updateRound = async data => {
    switch (data.type) {
        case "JOIN":
            switch (data.dbOffer.data.player) {
                case 2:
                    await Coinflip.joinRound(data);
                    break;
            }
            break;
        case "ACCEPT":
            switch (data.dbOffer.data.player) {
                case 1:
                    await Coinflip.createRound(data);

                    emitToSteamID(data.dbOffer.partner, "onCreateOfferUpdate", {
                        tradeofferid: data.dbOffer.offerID,
                        accepted: true
                    });

                    break;
                case 2:

                    emitToSteamID(data.dbOffer.partner, "onJoinOfferUpdate", {
                        tradeofferid: data.dbOffer.offerID,
                        accepted: true
                    });

                    await Coinflip.finishRound(data.dbOffer.data.round_id);
                    break;
            }
            break;
        case "DECLINE":
            switch (data.dbOffer.data.player) {
                case 1:
                    //Nothing to do just ignore this cancel
                    break;
                case 2:
                    await Coinflip.joinerCancelled(data);
                    break;
            }
            break;
    }
};

Coinflip.updateUserStat = async (field, input, steamid) => {
    let args = {};
    args[field] = Db.sequelize.literal(field + ' + ' + input);

    await Db.User.update(
        args,
        {where: {steamid: steamid}}
    );
};

Coinflip.getHistory = async user => {
    const dbRounds = await Db.CoinflipRound.findAll({
        where: {
            status: 3
        },
        raw: true,
        limit: 50,
        order: [["id", "desc"]]
    });

    const rounds = [];

    for (let dbRound of dbRounds) {
        dbRound.creator = JSON.parse(dbRound.creator);
        dbRound.joiner = JSON.parse(dbRound.joiner);
        dbRound.hashes = JSON.parse(dbRound.hashes);
        let round = {
            "c_items": dbRound.creator.items,
            "c_value": dbRound.creator.value,
            "c_seed": dbRound.hashes.c_seed,
            "created_by": dbRound.creator.user,
            "created_on": moment(dbRound.createdAt).toISOString(),
            "now": Date.now(),
            "_id": dbRound.roundID,
            "server_hash": dbRound.hashes.hash,
            "server_seed": dbRound.hashes.seed,
            "server_secret": dbRound.hashes.secret,
            "roll": dbRound.hashes.roll,
            "status": dbRound.status,
            "j_items": dbRound.joiner.items,
            "j_join_on": dbRound.joiner.joinedAt,
            "j_value": dbRound.joiner.value,
            "j_seed": dbRound.hashes.j_seed,
            "joined_by": dbRound.joiner.user
        };
        round.winner_id = dbRound.winnerID;

        rounds.push(round);
    }

    emitToSteamID(user.steamid, "history", rounds);
};

Coinflip.OnNewConnection = async (socket) => {
    socket.emit("connected", {
        rounds: await Coinflip.getRounds(),
        "server_time": Date.now()
    });
};

io.on("connection", function (socket) {
    Coinflip.OnNewConnection(socket);

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

    socket.on('getRound', roundID => {
        if (Helper.Coinflip.isRoundID(roundID))
            Coinflip.watchRound(socket, roundID);
    });

    socket.on('history', () => {
        Coinflip.getHistory(user);
    });

    socket.on('createRound', data => {
        Coinflip.createOffer(user, data, false);
    });

    socket.on('joinRound', data => {
        Coinflip.createOffer(user, data, true);
    });

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

publicServer.listen(config.servers.ports.coinflip, () => {
    Log.info("HTTP & Socket.IO servers listening on port " + config.servers.ports.coinflip);

    //Coinflip.checkLastRound();
});

botServer.listen(config.botServers.coinflip, () => {
    Log.info("HTTP server for bots listening on port " + config.botServers.coinflip);
});