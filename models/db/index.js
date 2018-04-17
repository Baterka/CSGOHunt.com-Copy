const fs = require('fs'),
    path = require('path'),
    Sequelize = require('sequelize'),
    Op = Sequelize.Op,
    basename = path.basename(module.filename),
    config = require('../../config').database;

const db = {};

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    Object.assign(config.options, {
        operatorsAliases: Op
    })
);
fs
    .readdirSync(__dirname)
    .filter((file) =>
        (file.indexOf('.') !== 0) &&
        (file !== basename) &&
        (file.slice(-3) === '.js'))
    .forEach((file) => {
        const model = sequelize.import(path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.Op = Op;

db.action = {
    User: {
        update: async (data, where, createIfNotExists = true) => {
            try {
                const row = await db.User.findOne({where: where});
                if (row) {
                    await row.update(data);
                } else if (createIfNotExists) {
                    await db.User.create(data);
                } else
                    throw "User does not exist";
            } catch (err) {
                throw err;
            }
        },
        get: async (where) => {
            try {
                const data = await db.User.findOne({where: where});
                return data;
            } catch (err) {
                throw err;
            }
        },
        isAdmin: async (where) => {
            try {
                const data = await db.User.findOne({where: where, attributes: ['rank']});
                return (parseInt(data.rank) === 10)
            } catch (err) {
                throw err;
            }
        }
    },
    Round: {
        insert: async (data) => {
            try {
                await db.Round.create(data);
            } catch (err) {
                throw err;
            }
        },
        get: async (where) => {
            try {
                const data = await db.Round.findOne({where: where});
                return data;
            } catch (err) {
                throw err;
            }
        }
    },
    Offer: {
        insert: async (data) => {
            try {
                await db.Offer.create(data);
            } catch (err) {
                throw err;
            }
        },
        duplicate: async (id) => {
            try {
                let data = await db.Offer.findOne({
                    where: {offerID: id},
                    attributes: ['status']
                });
                if (!data)
                    return false;
                return data.dataValues.status !== 0;
            } catch (err) {
                return true;
            }
        },
        get: async (where) => {
            try {
                return await db.Offer.findOne({where: where});
            } catch (err) {
                throw err;
            }
        },
        update: async (data, where) => {
            try {
                await db.Offer.update(data, {where: where});
            } catch (err) {
                throw err;
            }
        },
        delete: async (where) => {
            try {
                await db.Offer.destroy({where: where});
            } catch (err) {
                throw err;
            }
        },
        pop: async (botID) => {
            try {
                const data = await db.Offer.findOne({
                    where: {
                        desiredState: {
                            [Op.ne]: 0,
                        },
                        botID: botID
                    }
                });
                if (data)
                    await data.update({desiredState: 0});
                return data;
            } catch (err) {
                throw err;
            }
        }
    }
};

module.exports = db;