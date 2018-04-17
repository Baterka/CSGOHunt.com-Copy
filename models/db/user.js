module.exports = (sequelize, DataTypes) => {
    return sequelize.define('User', {
        steamid: {
            type: DataTypes.CHAR(17),
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(32),
            allowNull: false,
            unique: false
        },
        rank:{
            type: DataTypes.STRING(2),
            allowNull: false,
            defaultValue: 0
        },
        avatar: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        tradeToken: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        xp: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalBet: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
        totalWon: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
        coinflipTotalBet: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
        coinflipTotalWon: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        timestamps: false
    });
};