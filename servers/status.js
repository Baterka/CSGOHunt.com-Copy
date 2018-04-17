const socketio = require('socket.io'),
    axios = require('axios'),
    config = require('../config'),
    Helper = require('../models').Helper,
    models = require('../models');

const Log = models.Log;

const io = socketio();

const originURL = "http://localhost:";

broadcast();

async function broadcast() {
    let jackpot = await emit(config.botServers.jackpot, "totalValue");
    let coinflip = await emit(config.botServers.coinflip, "totalValue");

    io.sockets.emit('currentlyPlayed', {
        "jackpot_total": jackpot,
        "cf_total": coinflip
    });

    await Helper.delay(2000);
    broadcast();
}

async function emit(port, action) {
    try {
        let res = await axios.request({
            method: "post",
            url: originURL + port + "/" + action,
            timeout: 500
        });
        return res.data;
    } catch (err) {
        //Log.error("Port: " + port + " " + err.toString());
        return 0;
    }
}

module.exports = io;
