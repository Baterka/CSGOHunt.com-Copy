module.exports = {
    servers: {
        ports: {
            website: 3000,
            chat: 3001,
            jackpot: 3002,
            coinflip: 3003
        },
        cookie: {
            domain: ".domain.com",
            secret: "GeezyoSucks"
        }
    },
    botServers: {
        jackpot: 3004,
        coinflip: 3005
    },
    database: {
        database: "",
        username: "",
        password: "",
        options: {
            host: 'localhost',
            dialect: 'mysql',
            pool: {
                max: 5,
                min: 0,
                idle: 10000
            },
            logging: false
        }
    },
    logging: {
        debug: true,
        file: "logs/main.log"
    },
    website: {
        name: "CSGOHunt.com",
        defaultTitle: "CS:GO Jackpot / Coinflip",
        url: "https://hunt.domain.com",
        support: "http://support.csgohunt.com",
        facebook: "https://www.facebook.com/CZBaterka",
        twitter: "https://twitter.com/CZBaterka",
        meta: {
            description: "CSGO Jackpot and Coinflip : Build your dream inventory by winning hundreds of items on CSGOHunt.com and enjoy the thrill of playing Counter-Strike Global Offensive skins with other players all around the world!",
            keywords: "cs:go jackpot, cs:go skins jackpot, cs:go best jackpot, csgojackpot, cs:go skin, win cs:go skins, cs:go skins, cs:go coinflip, cs:go coin flip"
        }
    },
    steam: {
        apiKey: "",
        avatarStore: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/",
        botsAdmins: [
        ],
        bots: {
            0: {
                serverID: "jackpot",
                cancelOfferAfter: 10,
                tradelink: "",
                account: {
                    username: "",
                    steamID: "",
                    name: "",
                    password: "",
                    sharedSecret: "",
                    identitySecret: ""
                }
            },
            1: {
                serverID: "coinflip",
                cancelOfferAfter: 2,
                tradelink: "",
                account: {
                    username: "",
                    steamID: "",
                    name: "",
                    password: "",
                    sharedSecret: "",
                    identitySecret: ""
                }
            }
        },
        inventoryFetchLimiter: 1, //Seconds
    },
    global: {
        siteAppID: 730,
        xpPerLevel: 100,
        jackpot: {
            earlyTimer: 10,
            earlyStartBets: 1,
            finalTimer: 3,
            potItemsLimit: 10,
            fee: 25, //%
            alertBar: [
                {
                    type: "giveaway",
                    html: "🎁 test.com - Butterfly Knife Fade Giveaway 🎁"
                    + "<a href=\"\" target=\"_blank\">Don't click here</a>"
                }
            ]
        },
        coinflip: {
            fee: 10, //%
        }
    },
    client: {
        sockets: {
            status: "//domain.com",
            chat: "//chat.domain.com",
            jackpot: "//jackpot.domain.com",
            coinflip: "//coinflip.domain.com"
        }
    },
    prices: {
        file: "./prices.json"
    },
    offers: {
        jackpot: {
            maxItems: 5,
            minItemPrice: 1, //¢ (cents)
            minTotalPrice: 1, //¢ (cents)
            maxResendAttempts: 10,
            forbiddenItems: []
        },
        coinflip: {
            maxItems: 5,
            minItemPrice: 1, //¢ (cents)
            minTotalPrice: 1, //¢ (cents)
            maxResendAttempts: 10,
            forbiddenItems: []
        }
    }
};