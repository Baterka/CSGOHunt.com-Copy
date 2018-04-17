# CSGOHunt.com - Copy

Almost iodentical copy of [CSGOHunt.com](https://www.csgohunt.com/). Full NodeJS project.

### Powered by

* [Node.js](http://nodejs.org)
* [MariaDB](https://mariadb.org/)

### Installation

Requires [Node.js](https://nodejs.org/) 8+ and [MariaDB](https://mariadb.org/) 10.2+ database to run.

Install the dependencies:

```sh
$ npm install
```

Rename [config.index.js](https://github.com/Baterka/CSGOHunt.com-Copy/blob/master/config/index.example.js) file to index.js and fill all required data.

Start website:

```sh
$ node bin/www
```

Start servers:

```sh
$ node servers/[jackpot|coinflip|chat].js
```

Start bots:

```sh
$ node bot/[jackpot|coinflip].js
```

I recommend using [pm2](https://github.com/Unitech/pm2) for managing bot.

### Todos
 - Code revision
 - Testing
 - Rewrite to Non-relational database (MongoDB)