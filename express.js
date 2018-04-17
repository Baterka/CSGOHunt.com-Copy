const express = require('express'),
    expressLayouts = require('express-ejs-layouts'),
    path = require('path'),
    favicon = require('serve-favicon'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    csrf = require('csurf'),
    SessionStore = require('express-sequelize-session')(session.Store),
    app = express(),
    passport = require('./models/passport'),
    config = require('./config'),
    models = require('./models');

const Db = models.Db,
    Log = models.Log;

Db.sequelize.sync();

const sessionStore = new SessionStore(Db.sequelize);

const auth = require('./routes/auth')(passport),
    jackpot = require('./routes/jackpot'),
    coinflip = require('./routes/coinflip'),
    giveaway = require('./routes/giveaway'),
    leaderboard = require('./routes/leaderboard'),
    getStarted = require('./routes/getStarted'),
    faq = require('./routes/faq'),
    coinflipFaq = require('./routes/coinflip-faq'),
    terms = require('./routes/terms'),
    editProfile = require('./routes/edit-profile'),
    api = require('./routes/api');

// APP - VIEW ENGINE SETUP
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// APP - SETUP
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//APP - SESSION
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

//APP - CSRF
app.use(csrf());
app.use(function (req, res, next) {
    res.locals._csrf = req.csrfToken();
    next();
});

//APP - PASSPORT
app.use(passport.initialize());
app.use(passport.session());

//APP - DEFAULT TEMPLATE VARIABLES
app.use(function (req, res, next) {
    res.locals.user = req.user;
    res.locals.config = config;
    res.locals.language = req.headers["accept-language"];
    res.locals.page = {
        title: config.website.defaultTitle
    };
    next();
});

//APP - ROUTES
app.use('/', jackpot);
app.use('/auth', auth);
app.use('/coinflip', coinflip);
app.use('/giveaway', giveaway);
app.use('/leaderboard', leaderboard);
app.use('/get-started', getStarted);
app.use('/faq', faq);
app.use('/coinflip-faq', coinflipFaq);
app.use('/terms', terms);

app.use('/edit-profile', editProfile);

app.use('/api', api);


app.io = require('./servers/status');

//APP - CATCH 404
app.use(function (req, res, next) {
    res.locals.error = {
        title: "Page not found",
        code: 404,
        message: "The page you are trying to reach does not exists."
    };
    res.status(404);
    res.render('error', {
        layout: 'layouts/error'
    });
});

//APP - CATCH OTHER ERRORS
app.use(function (err, req, res, next) {
    res.locals.error = {
        title: "Error " + (err.status || 500),
        code: err.status,
        message: req.app.get('env') === 'development' ? err : ""
    };
    Log.error(err);
    res.locals.config = config;
    res.status(err.status || 500);
    res.render('error', {
        layout: 'layouts/error'
    });
});

module.exports = app;
