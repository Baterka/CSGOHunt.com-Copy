const axios = require('axios'),
    config = require('../config'),
    Db = require('./db'),
    Log = require('./log'),
    Helper = require('./helper');

const inventoryFetches = {};

const prices = require('../prices.json');

Api = {};

Api.updateProfile = async (req, res) => {
    let data = req.body,
        steamid = res.locals.user.steamid,
        tradeToken = res.locals.user.tradeToken;

    let ret = {
        result: true
    };

    let tradelinkRegex = new RegExp("https:\\/\\/steamcommunity\\.com\\/tradeoffer\\/new\\/\\?partner=[0-9]{1,}&token=[a-zA-Z0-9_-]{1,10}$");

    if (!data.tradeurl) {
        ret.result = false;
        ret.message = "You need to enter something first.";
        return ret;
    }

    if (!tradelinkRegex.test(data.tradeurl)) {
        ret.result = false;
        ret.message = "Invalid trade link.";
        return ret;
    }

    let steamid3 = Helper.getSteamID3(steamid);
    let params = Helper.parseGetParameters(data.tradeurl);

    if (parseInt(params['partner']) !== steamid3) {
        ret.result = false;
        ret.message = "This trade link not belongs to this account.";
        return ret;
    }

    if (params['token'] === tradeToken) {
        return ret;
    }

    try {
        await Db.action.User.update({tradeToken: params['token']}, {steamid: steamid}, false);
        return ret;
    }
    catch (err) {
        Log.error("An error occurred while saving tradelink: " + err);
        ret.result = false;
        ret.message = "Trade link not saved.";
        return ret;
    }
};

Api.getInventory = async steamid => {
    let ret = {};

    if (!Helper.isSteamID64(steamid))
        return ret;

    if (inventoryFetches[steamid] && inventoryFetches[steamid] > Date.now()) {
        ret.error = "You can only refresh once every " + config.steam.inventoryFetchLimiter + " seconds.";
        return ret;
    }

    try {
        const res = await axios.get("http://steamcommunity.com/inventory/" + steamid + "/" + config.global.siteAppID + "/2?l=english&count=1000");

        inventoryFetches[steamid] = Date.now() + (config.steam.inventoryFetchLimiter * 1000);

        const data = res.data;
        let inventory = [];
        const descriptions = {};

        for (let i in data.descriptions) {
            let description = data.descriptions[i];
            descriptions[description.classid] = description;
        }

        for (let i in data.assets) {
            let asset = data.assets[i];
            let item = descriptions[asset.classid];
            let price = prices[item.market_hash_name];
            if (price) {
                inventory.push({
                    "name": item.market_name,
                    "color": item.name_color,
                    "id": asset.assetid,
                    "img": "https://steamcommunity-a.akamaihd.net/economy/image/class/" + config.global.siteAppID + "/" + asset.classid + "/120fx100f",
                    "price": price
                });
            }
        }

        inventory = Helper.sortBy(inventory);

        return {
            data: inventory
        };
    } catch (err) {
        Log.error("An error occurred while fetching steam inventory: " + err);
        ret.error = "Steam error.";
        return ret;
    }
};

Api.coinflipProvably = async data => {
    try {
        const seed = data.server_seed,
            c_seed = data.c_seed,
            j_seed = data.j_seed;

        if (!seed || !c_seed || !j_seed || seed === "" || c_seed === "" || j_seed === "")
            return {
                error: "You need to set all the seed to check the roll"
            };

        if (!/^[a-zA-Z0-9]*$/ig.test(seed) || !/^[a-zA-Z0-9]*$/ig.test(c_seed) || !/^[a-zA-Z0-9]*$/ig.test(j_seed))
            return {
                error: "All the seed must be in valid format"
            };

        let hashes = '{"seed" : "' + seed + '","c_seed" : "' + c_seed + '","j_seed" : "' + j_seed + '"}';

        let round = await Db.CoinflipRound.findOne({
            where: {
                [Db.Op.and]: [
                    Db.sequelize.fn('JSON_CONTAINS', Db.sequelize.col('hashes'), hashes, '$'),
                    {'status': 3}
                ]
            },
            attributes: [
                [Db.sequelize.fn('JSON_VALUE', Db.sequelize.col('hashes'), '$.percent'), 'percent']
            ]
        });
        console.log(round);
        if (round)
            return {
                roll: round.dataValues.percent
            };
        else
            return {
                roll: Helper.Generate.coinflipPercent(seed + c_seed + j_seed)
            };
    } catch(err){
        console.log(err);
    }
};

module.exports = Api;

/*let a = {
    color: "D2D2D2"
    id: "14282850077"
    img: "https://steamcommunity-a.akamaihd.net/economy/image/class/730/575563074/120fx100f"
    name: "Glock-18 | Reactor (Field-Tested)"
    price: 152
};*/