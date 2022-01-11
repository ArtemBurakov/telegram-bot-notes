const query = require('../db/db-connection');
const { multipleColumnSet } = require('../utils/common.utils');

const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000);
}

const ACTIVE_STATUS = 10;

class SubjectModel {
    tableName = 'subjects';

    findOne = async (params) => {
        console.log('DATABASE `subject model` findOne')

        const { columnSet, values } = multipleColumnSet(params)

        const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

        const result = await query(sql, [...values]);

        // return back the first row (subject)
        return result[0];
    }

    find = async (user_id) => {
        console.log('DATABASE `subject model` find')

        const sql = `SELECT * FROM ${this.tableName} WHERE user_id = ? AND status = ? ORDER BY updated_at DESC`;

        const result = await query(sql, [user_id, ACTIVE_STATUS]);

        return result;
    }

    create = async (user_id, name) => {
        console.log('DATABASE `subject model` create')

        const sql = `INSERT INTO ${this.tableName}
        (user_id, name, status, created_at, updated_at) VALUES (?,?,?,?,?)`;

        const result = await query(sql, [user_id, name, ACTIVE_STATUS, getCurrentTimestamp(), getCurrentTimestamp()]);
        const affectedRows = result ? result.affectedRows : 0;

        return affectedRows;
    }
}

module.exports = new SubjectModel;
