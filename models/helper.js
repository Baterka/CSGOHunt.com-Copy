const SteamID = require('steamid'),
    crypto = require('crypto'),
    config = require('../config');

const Helper = {
        Generate: {},
        Steam: {},
        User: {},
        Item: {},
        Offer: {},
        Coinflip: {}
    },
    ETradeOfferStates = {
        "1": "Invalid",
        "2": "Active",
        "3": "Accepted",
        "4": "Countered",
        "5": "Expired",
        "6": "Canceled",
        "7": "Declined",
        "8": "InvalidItems",
        "9": "NeedsConfirmation",
        "10": "Canceled (2FA)",
        "11": "InEscrow"
    },
    ERoundStates = {
        "0": "WaitingForBets",
        "1": "EarlyTimer",
        "2": "FinalTimer",
        "3": "Over",
    },
    ECoinflipRoundStates = {
        "1": "WaitingForJoiner",
        "2": "WaitingForJoinerConfirm",
        "3": "Over",
    };

/**
 * Global
 */

Helper.getSteamID3 = (steamid64) => {
    return new SteamID(steamid64).accountid
};

Helper.isSteamID64 = string => {
    if (!string)
        return;
    try {
        return new SteamID(string).isValid();
    } catch (err) {
        return false;
    }
};

Helper.remove = (array, element) => {
    const index = array.indexOf(element);

    if (index !== -1) {
        array.splice(index, 1);
    }
};

Helper.isset = variable => {
    return typeof variable !== 'undefined' && variable !== "";
};

Helper.toUSD = cents => {
    let usd = cents / 100;
    return Number.isInteger(usd) ? usd : parseFloat(usd.toFixed(2));
};

Helper.toCents = usd => {
    let cents = usd * 100;
    return Math.round(cents);
};

Helper.roundStatus = status => {
    return ERoundStates[status];
};

Helper.coinflipRoundStatus = status => {
    return ECoinflipRoundStates[status];
};

Helper.playerItemsCount = (items, steamid) => {
    let count = 0;
    items.forEach(item => {
        if (item.from_steamID === steamid)
            count++;
    });
    return count;
};

Helper.sumArray = array => {
    let sum = 0;
    for (let num of array) {
        sum += parseInt(num);
    }
    return sum;
};

Helper.delay = ms => new Promise(resolve => setTimeout(resolve, ms));

Helper.parseGetParameters = string => {
    let params = {};
    let lets = string.split('?');
    lets = lets[1].split('&');
    for (let i = 0; i < lets.length; i++) {
        let pair = lets[i].split('=');
        params[pair[0]] = pair[1];
    }
    return params;
};

Helper.sortBy = (items, field = "price", asc = false) => {
    return items.sort(function (a, b) {
        if (!asc)
            return b[field] - a[field];
        else
            return a[field] - b[field];
    });
};

/**
 * Generate
 */

Helper.Generate.hash = () => {
    return crypto.randomBytes(20).toString('hex');
};


Helper.Generate.roundHashes = () => {
    let percentage = (Math.random() * 100).toFixed(14),
        secret = crypto.randomBytes(5).toString('hex'),
        hash = crypto.createHash('md5').update(percentage.toString() + ":" + secret).digest().toString('hex');
    return {
        percentage,
        secret,
        hash
    }
};

Helper.Generate.coinflipPercent = string =>{
    string = crypto.createHash('sha256').update(string).digest().toString('hex');
    return 100 * (parseInt(string, 16) / Math.pow(16, 64));
};

Helper.Generate.coinflipRoundHashes = () => {
    let seed = crypto.randomBytes(16).toString('hex'),
        secret = crypto.randomBytes(16).toString('hex'),
        hash = crypto.createHash('sha256').update(seed).digest().toString('hex');
    return {
        seed,
        secret,
        hash
    }
};
Helper.Generate.coinflipRoundHashes();

Helper.Generate.roundID = () => {
    return crypto.createHash('md5').update(Date.now().toString()).digest().toString('hex').slice(0, 24);
};

Helper.Generate.randomNum = (from, to) => {
    return Math.floor(Math.random() * to) + from
};

Helper.Generate.offerPin = () => {
    return crypto.createHash('md5').update(Date.now().toString() + crypto.randomBytes(5).toString('hex')).digest().toString('hex').slice(0, 8);
};

/**
 * Steam
 */

Helper.Steam.ETradeOfferState = state => {
    return ETradeOfferStates[state];
};

/**
 * User
 */

Helper.User.buildAvatar = (hash, size = "") => {
    return config.steam.avatarStore + hash.slice(0, 2) + "/" + hash + (size !== "" ? "_" : "") + size + ".jpg";
};

Helper.User.computeLevel = (xp) => {
    return Math.floor(xp / config.global.xpPerLevel);
};

/**
 * Item
 */

Helper.Item.buildImageURL = (classid, size = "120fx100", appid = config.global.siteAppID) => {
    return "https://steamcommunity-a.akamaihd.net/economy/image/class/" + appid + "/" + classid + "/" + size + "f";
};

Helper.Item.sumPrices = items => {
    let sum = 0;
    for (let item of items) {
        sum += parseInt(item.price)
    }
    return sum;
};


/**
 * Offer
 */

Helper.Offer.isGift = offer => {
    return offer.itemsToGive.length === 0 && offer.itemsToReceive.length > 0
};

/**
 * Coinflip
 */

Helper.Coinflip.isRoundID = input => {
    return (typeof input === "string") && input.length === 24
        && !isNaN(parseInt(input, 16));
};

module.exports = Helper;