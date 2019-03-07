const Sequelize = require('sequelize');
const db = require('../config/db');
const { logger } = require("../helpers/logger");
const { accountModel } = require('./account');
const CircularJSON = require('circular-json');
const MIN_THRESHOLD = 200;

const errorLogModel = db.connection.define('log_error', {
    account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    created_at: Sequelize.INTEGER
}, {
        timestamps: false,
        hooks: {
            beforeCreate: (log) => {
                log.created_at = new Date().getTime();
            }
        }
    });


errorLogModel.belongsTo(accountModel, { foreignKey: 'account_id' });

exports.errorLogModel = errorLogModel;

exports.add = (accountId, description, originatedFrom = '') => {

    if (description
        && (
            description.toString().indexOf("StatusCodeError: 404") > -1
            || description.toString().indexOf("StatusCodeError: 409") > -1
            || description.toString().indexOf("SequelizeUniqueConstraintError") > -1
        )
    ) {
        return;
    }

    logger.error("---~ERROR~---" + ' ' + originatedFrom + ' ' + description);
    errorLogModel.create({
        account_id: accountId,
        description: description ? CircularJSON.stringify(description).replace(/"/g, '') : '',
        created_at: new Date().getTime()
    })
        .then(({ dataValues: logData }) => {
            errorLogModel.findOne({
                attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
            })
                .then(({ dataValues: count }) => {
                    // Delete old records
                    if (count.total > MIN_THRESHOLD) {
                        let removableId = logData.id - MIN_THRESHOLD;

                        exports.deleteAllLessThan(removableId);
                    }
                })
                .catch(error => console.log(error));
        })
        .catch(error => {
            console.log('error', error);
        });
};

exports.deleteAllLessThan = id => {
    errorLogModel.destroy({
        where: {
            id: {
                [Sequelize.Op.lt]: id
            }
        }
    })
        .then()
        .catch(error => console.log(error))
};