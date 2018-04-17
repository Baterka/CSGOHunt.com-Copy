module.exports = (sequelize, DataTypes) => {
    return sequelize.define('CoinflipRound', {
        roundID: {
            type: DataTypes.CHAR(24),
            allowNull: false,
            unique: true
        },
        hashes: {
            type: DataTypes.JSON,
            allowNull: false
        },
        status: {
            type: DataTypes.INTEGER(1),
            defaultValue: 1,
            allowNull: false,
        },
        creator: {
            type: DataTypes.JSON,
            defaultValue: [],
            allowNull: false
        },
        joiner: {
            type: DataTypes.JSON,
            defaultValue: [],
            allowNull: false
        },
        winnerID: {
            type: DataTypes.CHAR(17),
            allowNull: true,
        }
    });
};