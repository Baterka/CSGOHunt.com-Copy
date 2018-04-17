const passport = require('passport'),
    SteamStrategy = require('passport-steam').Strategy,
    config = require('../config'),
    Log = require('./log'),
    Db = require('./db'),
    Helper = require('./helper');

passport.use(new SteamStrategy({
        returnURL: config.website.url + '/auth/return',
        realm: config.website.url,
        apiKey: config.steam.apiKey
    },
    function (identifier, profile, done) {
        return done(null, profile);
    }
));

passport.serializeUser(async (user, cb) => {
    let avatarUrl = user.photos[0].value.split("/");
    let data = {
        steamid: user.id,
        name: user.displayName,
        avatar: avatarUrl[avatarUrl.length - 1].slice(0, -4)
    };
    try {
        await Db.action.User.update(data, {steamid: user.id});
        cb(null, user.id);
    } catch (err) {
        Log.error("An error occurred while executing database action: " + err);
        cb(null, null);
    }
});

passport.deserializeUser(async (steamid, cb) => {
    try {
        const user = await Db.action.User.get({steamid: steamid});
        user.level = Math.floor(user.xp / config.global.xpPerLevel);
        user.avatar = config.steam.avatarStore + user.avatar.slice(0, 2) + "/" + user.avatar;
        user.tradelink = (user.tradeToken !== null ? "https://steamcommunity.com/tradeoffer/new/?partner=" + Helper.getSteamID3(steamid) + "&token=" + user.tradeToken : "");
        cb(null, user);
    } catch (err) {
        Log.error("An error occurred while executing database action: " + err);
        cb(null, null);
    }
});

passport.isAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth');
};

module.exports = passport;