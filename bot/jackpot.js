const SteamUser = require('steam-user'),
    SteamTotp = require('steam-totp'),
    TradeOfferManager = require('steam-tradeoffer-manager'),
    SteamCommunity = require('steamcommunity'),
    argv = require('yargs').argv,
    fs = require('fs'),
    async = require('async'),
    axios = require('axios'),
    stringArgv = require('string-argv'),
    fifo = require('fifo'),
    config = require('../config'),
    models = require('../models');

//require('../models/dev-usage');


const Db = models.Db,
    Log = models.Log,
    Helper = models.Helper;

const originURL = "http://localhost:";
let botID = 0;

if (argv.id && argv.id > 0)
    botID = argv.id;


Log.info("Bot #" + botID + " starting...");

if (!Helper.isset(config.steam.bots[botID])) {
    Log.error("Bot with ID " + botID + " does not exist in config.");
    Log.warn("Terminating process...");
    process.exit(1);
}


const disableIncoming = config.steam.bots[botID].disableIncoming;


const serverID = config.steam.bots[botID].serverID;

//Create instances
let client = new SteamUser(),
    community = new SteamCommunity();
manager = new TradeOfferManager({
    "steam": client,
    "community": community,
    "language": "en",
    "pollInterval": "10000",
    "cancelTime": config.steam.bots[botID].cancelOfferAfter * 60000
});

//Login bot
client.logOn({
    accountName: config.steam.bots[botID].account.name,
    password: config.steam.bots[botID].account.password,
    twoFactorCode: SteamTotp.getAuthCode(config.steam.bots[botID].account.sharedSecret),
    rememberPassword: true
});

/**
 * SteamUser events
 */

client.on('error', (err) => {
    Log.error("Login failed with error: " + SteamUser.EResult[err.eresult]);
});

client.on("loggedOn", () => {
    client.setPersona(SteamUser.EPersonaState.Online, config.steam.bots[botID].username);
    client.getPersonas([client.steamID], (personas) => {
        Log.info("Logged as '" + personas[client.steamID].player_name + "' (" + client.steamID + ")");
    });
});

client.on("webSession", (sessionID, cookies) => {
    manager.setCookies(cookies, (err) => {
        if (err) {
            Log.error("An error occurred while setting cookies:" + err);
            return;
        }
        Log.info("Websession created and cookies set");
        Bot.Outgoing.process();
        Bot.Outgoing.check();
        //resolveOffers();
    });
    community.setCookies(cookies);
    community.startConfirmationChecker(10000, config.steam.bots[botID].account.identitySecret);
    Bot.Steam.setPlaying();
});

client.on("groupRelationship", (sender, rel) => {
    if (rel === SteamUser.EClanRelationship.Invited) {
        Log.debug("Invite to group '" + sender.getSteamID64() + "' automatically ignored");
        client.respondToGroupInvite(sender, false);
    }
});

client.on("friendRelationship", (sender, rel) => {
    if (rel === SteamUser.EFriendRelationship.RequestRecipient)
        client.addFriend(sender);
});

client.on("friendMessage", async (sender, message) => {
    let steamid = sender.getSteamID64();

    let isAdmin = (config.steam.botsAdmins.includes(steamid) >= 0);

    if (isAdmin) {
        if (message.charAt(0) === "!") {
            let command = stringArgv.parseArgsStringToArgv(message.slice(1));

            if (command[0])
                command[0] = command[0].toUpperCase();

            switch (command[0]) {
                case "HELP": {
                    let helpString =
                        "Available commands:\n" +
                        "!help - List of available commands";
                    client.chatMessage(steamid, helpString);
                }
                    break;
                case "FAKE": {
                    let data;

                    if (Helper.isSteamID64(command[1])) {
                        data = {
                            steamid: command[1]
                        };
                    } else if (command[1] === "cancel") {
                        data = {
                            cancel: true
                        };
                    }

                    if (!data) {
                        client.chatMessage(steamid, "Bad inputs! Usage: /fake <SteamID64>");
                        return;
                    }

                    client.chatMessage(steamid, "Sending request to jackpot server...");
                    let res;
                    try {
                        res = await Bot.emit("fake", data);
                    } catch (err) {
                        Log.error("Server '" + serverID + "': Error code " + err.response.status);
                        client.chatMessage(steamid, "Communication with server failed with code: " + err.response.status);
                        return;
                    }
                    client.chatMessage(steamid, res.message);
                }
                    break;
                default: {
                    client.chatMessage(steamid, "Command not found! Use !help");
                }
                    break;

            }
        } else
            client.chatMessage(steamid, "I am accepting commands only (Messages starting with '!')");
    }
});

/**
 * TradeOfferManager events
 */

manager.on("sentOfferChanged", offer => {
    Log.warn("Outgoing offer #" + offer.id + " changed state to: " + TradeOfferManager.ETradeOfferState[offer.state]);
    Bot.Outgoing.changesQueue.push(offer);
});

manager.on("receivedOfferChanged", async offer => {
    Log.warn("Incoming offer #" + offer.id + " changed state to: " + TradeOfferManager.ETradeOfferState[offer.state]);
    if (!disableIncoming)
        Bot.Incoming.changesQueue.push(offer);
});

manager.on("newOffer", async offer => {
    if (disableIncoming) {
        Log.debug("New incoming offer #" + offer.id + "! Cancelling...");
        await Bot.Offer.decline(offer);
    } else {
        Log.debug("New incoming offer #" + offer.id + "! Queued...");
        Bot.Incoming.queue.push(offer);
    }
});

manager.on('pollFailure', (msg) => {
    Log.warn("Pool failed: " + msg);
});

/**
 * SteamCommunity events
 */

community.on("sessionExpired", () => {
    Log.warn("Session Expired. Relogging...");
    client.webLogOn();
});

/**
 * Functions
 */

const Bot = {
    Incoming: {},
    Outgoing: {},
    Offer: {},
    Steam: {},
    Inventory: {},
};

/**
 * Outgoing
 */

Bot.Outgoing.changesQueue = fifo();

Bot.Outgoing.next = async () => {
    await Helper.delay(500);
    Bot.Outgoing.process();
};

Bot.Outgoing.check = async () => {
    let offers = await Db.Offer.findAll({
        where: {
            type: "OUTGOING",
            currentState: {
                [Db.Op.or]: [
                    {[Db.Op.eq]: 2},
                    {[Db.Op.eq]: 9}
                ]
            },
            botID: botID,
            attempts: {[Db.Op.lt]: config.offers[serverID].maxResendAttempts}
        },
        order: [['updatedAt', 'ASC']]
    });

    async.eachSeries(offers, async (dbOffer, callback) => {
        let offer;

        try {
            offer = await Bot.Offer.get(dbOffer.offerID);
        } catch (err) {
            Log.error("An error occured while getting offer #" + dbOffer.offerID + ": " + err);
            callback();
        }

        if (offer.state !== dbOffer.currentState) {
            Log.warn("Outgoing offer #" + offer.id + " changed state to: " + TradeOfferManager.ETradeOfferState[offer.state]);
            Bot.Outgoing.changesQueue.push(offer);
        }

        callback();
    }, err => {
        Log.info("All active outgoing offers checked for new steam status.");
    });
};

Bot.Outgoing.process = async () => {
    let offer = await Db.Offer.findOne({
        where: {
            type: "OUTGOING",
            currentState: {
                [Db.Op.and]: [
                    {[Db.Op.ne]: 3},
                    {[Db.Op.ne]: 2},
                    {[Db.Op.ne]: 9}
                ]
            },
            botID: botID,
            attempts: {
                [Db.Op.and]: [
                    {[Db.Op.lt]: config.offers[serverID].maxResendAttempts},
                    {[Db.Op.ne]: -1}
                ]
            }
        },
        limit: 1,
        order: [['updatedAt', 'ASC']]
    });

    if (!offer) {
        Bot.Outgoing.next();
        return;
    }

    let token;
    try {
        token = await Bot.getTradeToken(offer.partner);
    } catch (err) {
        Log.error("Queued again. Error while getting user's tradetoken:" + err);
        await Db.action.Offer.update({
            message: "Error while getting tradelink"
        }, {offerID: offer.id});
        Bot.Outgoing.next();
        return;
    }

    let trade = manager.createOffer(new TradeOfferManager.SteamID(offer.partner), token);

    offer.items = JSON.parse(offer.items);
    let items;
    try {
        items = await Bot.Inventory.getMyItems(offer);
    } catch (err) {
        Log.error("Queued again. Error while getting items: " + err);
        Bot.Outgoing.next();
        return;
    }

    let offerData = JSON.parse(offer.data);

    trade.addMyItems(items);
    trade.setMessage("You won round '" + offerData.roundID + "' on " + config.website.name + "! PIN: " + offerData.pin);
    trade.send(async err => {
        if (err) {
            Log.error("Queued again. An error occurred while sending trade: " + err);
            await Db.action.Offer.update({
                message: "Error while sending offer",
                attempts: Db.sequelize.literal('attempts + 1')
            }, {id: offer.id});
            Bot.Outgoing.next();
            return;
        }
        Log.info("Outgoing offer #" + trade.id + " was sent successfully!");

        /*community.acceptConfirmationForObject(config.steam.bots[botID].account.identitySecret, trade.id, err => {
            if(err){
                Log.info("Confirmation failed for outgoing offer #" + trade.id + ".");
                return;
            }
            Log.info("Outgoing offer #" + trade.id + " was confirmed successfully!");
        });*/

        await Db.action.Offer.update({
            offerID: trade.id,
            message: "Waiting for confirmation",
            currentState: trade.state,
            attempts: (offerData.bet ? -1 : Db.sequelize.literal('attempts + 1')),
        }, {id: offer.id});
        Bot.Outgoing.next();
    });
};

Bot.Outgoing.changed = async () => {
    if (Bot.Outgoing.changesQueue.length > 0) {
        let offer = Bot.Outgoing.changesQueue.shift(),
            message = "";

        switch (offer.state) {
            case 2:
                message = "Active";
                break;
            case 3:
                Log.info("Outgoing offer #" + offer.id + " was accepted by user.");
                message = "Accepted by user";
                break;
            default:
                Log.warn("Outgoing offer #" + offer.id + " was not accepted. Queued again.");
                if (offer.state === 4) {
                    message = "Counter offer";
                }
                break;
        }

        await Db.action.Offer.update({
            currentState: offer.state,
            message: message
        }, {offerID: offer.id});
    }

    await Helper.delay(500);
    Bot.Outgoing.changed();
};

/**
 * Incoming
 */

Bot.Incoming.queue = fifo();

Bot.Incoming.changesQueue = fifo();

Bot.Incoming.next = async () => {
    await Helper.delay(500);
    Bot.Incoming.process();
};

Bot.Incoming.process = async () => {
    if (Bot.Incoming.queue.length) {
        let offer = Bot.Incoming.queue.shift();
        Log.debug("Processing incoming offer #" + offer.id);

        // Decline non-gift offer immediately
        if (!Helper.Offer.isGift(offer)) {
            Log.warn("Incoming offer #" + offer.id + " is not a gift! Cancelling...");
            try {
                await Bot.Offer.decline(offer);
            } catch (err) {
                Log.error(err);
                Bot.Incoming.queue.push(offer);
            }
            Bot.Incoming.next();
            return;
        }

        // Decline glitched offer immediately
        if (offer.isGlitched()) {
            Log.warn("Incoming offer #" + offer.id + " is glitched! Cancelling...");
            try {
                await Bot.Offer.decline(offer);
            } catch (err) {
                Log.error(err);
                Bot.Incoming.queue.push(offer);
            }
            Bot.Incoming.next();
            return;
        }

        try {
            offer.userDetails = await Bot.Offer.getUserDetails(offer);
        } catch (err) {
            Log.error("Offer #" + offer.id + " queued again because of error: " + err);
            Bot.Incoming.queue.push(offer);
            Bot.Incoming.next();
            return;
        }

        let formattedOffer = {
            offerID: offer.id,
            botID: botID,
            type: "INCOMING",
            currentState: offer.state,
            partner: offer.partner.toString()
        };

        try {
            await Db.action.Offer.insert(formattedOffer);
        } catch (err) {
            if (err instanceof Db.Sequelize.ValidationError) {
                Log.error("Incoming offer #" + offer.id + " is duplicate. Ignored. (" + err.message + ")");
            } else {
                Log.error("Incoming offer #" + offer.id + " queued again because of database error: " + err);
                Bot.Incoming.queue.push(offer);
            }
            Bot.Incoming.next();
            return;
        }

        // Try to send offer info to server
        let res;
        try {
            formattedOffer.items = Bot.minimalizeItems(offer.itemsToReceive);
            formattedOffer.userDetails = offer.userDetails;
            res = await Bot.emit("newIncomingOffer", formattedOffer);
        } catch (err) {
            if (err.response) {
                if (err.response.status === 406) {
                    Log.error("Server not ready. Incoming offer #" + offer.id + " queued again.");

                    //Give server some time before bombing by offers
                    await Helper.delay(3000);
                } else {
                    Log.error("Server '" + serverID + "': Error code " + err.response.status + ". Queued again.");
                }
            } else
                Log.error("Server '" + serverID + "': " + err.message + ". Queued again.");
            Bot.Incoming.queue.push(offer);
            Bot.Incoming.next();
            return;
        }

        // Successfull response from server
        Log.debug("Server response for offer #" + offer.id + ": " + (res.accept ? "ACCEPT" : "DECLINE"));
        try {
            if (res.accept) {
                await Bot.Offer.accept(offer);
                await Db.action.Offer.update({totalValue: res.totalPrice}, {offerID: offer.id});
                Bot.Incoming.changesQueue.push(offer);
            } else {
                await Bot.Offer.decline(offer);
                await Db.action.Offer.update({message: res.message}, {offerID: offer.id});
            }
        } catch (err) {
            await Db.action.Offer.delete({offerID: offer.id});
            Log.error("Deleted and queued again because of error: " + err);
            Bot.Incoming.queue.push(offer);
        }
    }
    Bot.Incoming.next();
};

Bot.Incoming.changed = async () => {
    if (Bot.Incoming.changesQueue.length > 0) {
        let offer = Bot.Incoming.changesQueue.shift();

        let message;
        if (offer.state === TradeOfferManager.ETradeOfferState.Accepted) {
            // Try to send offer change info to server
            offer.botID = botID;
            offer.partner = offer.partner.toString();
            try {
                await Bot.emit("offerStatus", offer);
                message = "Accepted by bot";
                Log.debug("Offer #" + offer.id + " successfully processed by server.");
            } catch (err) {
                if (err.response) {
                    if (err.response.status === 409) {
                        Log.error("Offer #" + offer.id + " was already processed by server. Ignoring.");
                    } else {
                        Log.error("Server '" + serverID + "' error code " + err.response.status + ". Offer change queued again.");
                        Bot.Incoming.changesQueue.push(offer);
                    }
                } else {
                    Log.error("Server '" + serverID + "': " + err.message + ". Queued again.");
                    Bot.Incoming.changesQueue.push(offer);
                }
            }
        }
        let updateString = {
            currentState: offer.state,
        };
        if (message)
            updateString.message = message;
        await Db.action.Offer.update(updateString, {offerID: offer.id});
    }

    await Helper.delay(500);
    Bot.Incoming.changed();
};

/**
 * Offer
 */

Bot.Offer.decline = async (offer) => {
    return new Promise(function (resolve, reject) {
        offer.decline(err => {
            if (err)
                reject("An error occurred while declining offer:" + err);
            Log.info("Offer #" + offer.id + " declined.");
            resolve();
        });
    });
};

Bot.Offer.accept = async (offer) => {
    return new Promise(function (resolve, reject) {
        offer.accept(err => {
            if (err)
                reject("An error occurred while accepting offer:" + err);

            Log.info("Offer #" + offer.id + " accepted.");
            resolve();
        });
    });
};

Bot.Offer.getUserDetails = async (offer) => {
    return new Promise(function (resolve, reject) {
        offer.getUserDetails(async (err, me, them) => {
            if (err)
                reject(err);
            else
                resolve({
                    me,
                    them
                });
        });
    });
};

Bot.Offer.get = async (offerID) => {
    return new Promise(function (resolve, reject) {
        manager.getOffer(offerID, async (err, offer) => {
            if (err)
                reject(err);
            else
                resolve(offer);
        });
    });
};

Bot.Offer.saveUnresolved = offer => {
    let filename = botID + "-" + offer.id + ".json";
    fs.writeFile("./bot/tmp/" + filename, JSON.stringify(offer, null, 2), (err) => {
        if (err)
            Log.error("An error occurred while writing to file: " + err);
    });
};

Bot.Offer.removeResolved = offerID => {
    let filename = botID + "-" + offerID + ".json";
    fs.stat("./bot/tmp/" + filename, function (err) {
        if (err == null) {
            fs.unlink("./bot/tmp/" + filename, (err) => {
                if (err)
                    Log.error("An error occurred while deleting file: " + err);
            });
        } else {
            Log.error("An error occurred while checking file: " + err);
        }
    });
};

/**
 * Steam
 */

Bot.Steam.setPlaying = () => {
    client.gamesPlayed(["Ready for offers..."]);
};

/**
 * Inventory
 */

Bot.Inventory.getMyItems = async (dbOffer) => {
    return new Promise(function (resolve, reject) {
        manager.getInventoryContents(config.global.siteAppID, 2, true, (err, inv) => {
            if (err)
                reject(err);

            if (!Helper.isset(inv))
                reject(err);

            for (let i = 0, len = inv.length; i < len; i++) {
                inv[i].used = false;
            }

            let items = [];
            for (let item of dbOffer.items) {
                if (items.length < dbOffer.items.length) {
                    for (let i of inv) {
                        if (i.market_hash_name === item.market_hash_name) {
                            if (!i.used) {
                                i.used = true;
                                items.push(i);
                                break;
                            }
                        }
                    }
                } else
                    break;
            }
            if (items.length === dbOffer.items.length)
                resolve(items);
            else
                reject("Missing items");
        });
    });
};

/**
 * Global
 */

Bot.emit = async (action, data) => {
    try {
        let res = await axios.request({
            method: "post",
            url: originURL + config.botServers[serverID] + "/" + action,
            data: data,
            timeout: 10000
        });
        return res.data;
    } catch (err) {
        throw err;
    }
};

Bot.minimalizeItems = (fullItems) => {
    let items = [];
    fullItems.forEach(item => {
        items.push({
            appid: item.appid,
            market_hash_name: item.market_hash_name,
            name: item.name,
            type: item.type,
            classid: item.classid
        })
    });
    return items;
};

Bot.getTradeToken = async (steamid) => {
    let user;
    try {
        user = await Db.action.User.get({steamID: steamid})
    } catch (err) {
        throw "Not found";
    }
    if (user.tradeToken !== null)
        return user.tradeToken;
    else
        throw "Not set";
};

/**
 * Launch queue checkers
 */

Bot.Incoming.next();
Bot.Incoming.changed();
Bot.Outgoing.changed();