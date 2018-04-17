module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Offer', {
        offerID: {
            type: DataTypes.CHAR(11),
            allowNull: true,
            unique: true
        },
        type: {
            type: DataTypes.CHAR(8),
            allowNull: false
        },
        botID: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        currentState: {
            type: DataTypes.INTEGER(2),
            defaultValue: -1,
            allowNull: false
        },
        partner: {
            type: DataTypes.CHAR(17),
            allowNull: false
        },
        message: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        items: {
            type: DataTypes.JSON,
            allowNull: true
        },
        totalValue:{
            type: DataTypes.INTEGER,
            defaultValue: -1,
            allowNull: false
        },
        status: {
            type: DataTypes.INTEGER(1),
            defaultValue: 0,
            allowNull: false
        },
        data: {
            type: DataTypes.JSON,
            allowNull: true
        },
        attempts: {
            type: DataTypes.INTEGER(3),
            defaultValue: 0,
            allowNull: false
        }
    });
};