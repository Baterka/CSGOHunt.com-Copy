module.exports = (sequelize, DataTypes) => {
    return sequelize.define('JackpotRound', {
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
            defaultValue: 0,
            allowNull: false,
        },
        players: {
            type: DataTypes.JSON,
            defaultValue: [],
            allowNull: false
        },
        bets: {
            type: DataTypes.JSON,
            defaultValue: [],
            allowNull: false
        },
        winnerSteamID: {
            type: DataTypes.CHAR(17),
            allowNull: true
        },
        winnerFee: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        feeItems: {
            type: DataTypes.JSON,
            defaultValue: [],
            allowNull: false
        },
        endedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    });
};