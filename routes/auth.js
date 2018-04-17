const app = require('express'),
    router = app.Router();

module.exports = function(passport) {
    router.get('/', passport.authenticate('steam'));

    router.get('/return',
        passport.authenticate('steam', { failureRedirect: '/404' }), (req, res) => {
            res.redirect('/');
        });

    router.get('/logout', function(req, res){
        req.logout();
        req.session.destroy();
        res.redirect('/');
    });

    return router;
};