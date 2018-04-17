const express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    socketio = require('socket.io'),
    passportSocketio = require('passport.socketio'),
    SessionStore = require('express-sequelize-session')(session.Store),
    app = express(),
    passport = require('../models/passport'),
    config = require('../config'),
    models = require('../models');

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

const server = require('http').createServer(app),
    io = socketio(server);

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

const maxArchivedMessages = 25;

let users = {},
    messages = [],
    online = 0;

let Chat = {};

Chat.PushMessageHistory = (message) => {
    messages.push(message);
    let len = messages.length;
    if (len > maxArchivedMessages) {
        messages = messages.slice(len - maxArchivedMessages, len);
    }
};

Chat.OnMessage = (user, msg, socket) => {
    if (!user) {
        socket.emit("chatError", {
            "message": "You need to be logged in to send message."
        });
        return;
    }
    let message = {
        "from": {
            "steamID": user.steamid,
            "displayName": user.name,
            "avatar": user.avatar + ".jpg",
            "profileUrl": "http://steamcommunity.com/profiles/" + user.steamid
        },
        "message": msg.message,
        "msg_date": new Date().toISOString(),
        "privilege": null,
    };
    Chat.PushMessageHistory(message);
    io.sockets.emit("chatMsg", message)
};

Chat.UpdateOnline = () => {
    online = Object.keys(io.sockets.connected).length;
};
Chat.EmitHistory = (socket) => {
    socket.emit('connected', messages);
};

Chat.BroadcastOnline = () => {
    io.sockets.emit('userCount', online);
};

io.on("connection", function (socket) {
    Log.debug('Client connected');
    Chat.UpdateOnline();
    Chat.EmitHistory(socket);

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

    socket.on('sendMessage', msg => {
        Chat.OnMessage(user, msg, socket)
    });

    socket.on('disconnect', function () {
        Chat.UpdateOnline();

        if (user && users[user.steamid].sockets.length > 1)
            Helper.remove(users[user.steamid].sockets, socket.id);
        else
            delete users[user.steamid];

        Log.debug('Client disconnected');
    });
});

setInterval(() => {
    Chat.BroadcastOnline();
}, 10000);


server.listen(config.servers.ports.chat, () => {
    Log.info("HTTP & Socket.IO servers listening on port " + config.servers.ports.chat);
});