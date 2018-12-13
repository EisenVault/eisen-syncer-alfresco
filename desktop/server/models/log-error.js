const Sequelize = require('sequelize');
const db = require('../config/db');
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

exports.connection = db.connection.sync({
    force: db.flush,
    logging: db.logging
});

exports.errorLogModel = errorLogModel;

exports.add = (accountId, description, originatedFrom = '') => {
    errorLogModel.create({
        account_id: accountId,
        description: String(description),
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

                    // if (description && description.toString().indexOf("StatusCodeError: 404") === -1) {
                    //     //log.error("---ERROR---", originatedFrom, description);
                    // }
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
            [Sequelize.Op.lt]: id
        }
    })
        .then()
        .catch(error => console.log(error))
};