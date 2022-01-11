const query = require('../db/db-connection');
const { multipleColumnSet } = require('../utils/common.utils');

const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000);
}

const DONE_STATUS = 20;
const ACTIVE_STATUS = 10;
const DELETED_STATUS = 0;

class HomeTaskModel {
    tableName = 'hometasks';

    findOne = async (params) => {
        console.log('DATABASE `hometask model` findOne')

        const { columnSet, values } = multipleColumnSet(params)

        const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

        const result = await query(sql, [...values]);

        // return back the first row
        return result[0];
    }

    find = async (user_id, subject_id, status) => {
        console.log('DATABASE `hometask model` find')

        const sql = `SELECT * FROM ${this.tableName} WHERE user_id = ? AND subject_id = ? AND status = ? ORDER BY updated_at DESC`;

        const result = await query(sql, [user_id, subject_id, status]);

        return result;
    }

    create = async (user_id, subject_id, text, deadline_at) => {
        console.log('DATABASE `hometask model` create')

        const sql = `INSERT INTO ${this.tableName}
        (user_id, subject_id, text, status, created_at, updated_at, deadline_at) VALUES (?,?,?,?,?,?,?)`;

        const result = await query(sql, [user_id, subject_id, text, ACTIVE_STATUS, getCurrentTimestamp(), getCurrentTimestamp(), deadline_at]);
        const affectedRows = result ? result : 0;

        return affectedRows;
    }

    update = async (params, id) => {
        console.log('DATABASE `hometask model` update')

        const { columnSet, values } = multipleColumnSet(params)
        const sql = `UPDATE ${this.tableName} SET ${columnSet} WHERE id = ?`;

        const result = await query(sql, [...values, id]);

        return result;
    }
}

module.exports = new HomeTaskModel;
