const query = require('../db/db-connection');
const { multipleColumnSet } = require('../utils/common.utils');

const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000);
}

const ACTIVE_STATUS = 10;

class NoteModel {
    tableName = 'notes';

    findOne = async (params) => {
        const { columnSet, values } = multipleColumnSet(params)

        const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

        const result = await query(sql, [...values]);

        // return back the first row
        return result[0];
    }

    find = async (user_id, status) => {
        const sql = `SELECT * FROM ${this.tableName} WHERE user_id = ? AND status = ? ORDER BY updated_at DESC`;

        const result = await query(sql, [user_id, status]);

        return result;
    }

    create = async (user_id, name, text, deadline_at) => {
        const sql = `INSERT INTO ${this.tableName}
        (user_id, name, text, status, created_at, updated_at, deadline_at) VALUES (?,?,?,?,?,?,?)`;

        const result = await query(sql, [user_id, name, text, ACTIVE_STATUS, getCurrentTimestamp(), getCurrentTimestamp(), deadline_at]);
        const affectedRows = result ? result : 0;

        return affectedRows;
    }

    update = async (params, id, user_id) => {
        const { columnSet, values } = multipleColumnSet(params)
        const sql = `UPDATE notes SET ${columnSet} WHERE id = ? AND user_id = ?`;

        const result = await query(sql, [...values, id, user_id]);

        return result;
    }

    // delete = async (id) => {
    //     const sql = `DELETE FROM ${this.tableName}
    //     WHERE id = ?`;
    //     const result = await query(sql, [id]);
    //     const affectedRows = result ? result.affectedRows : 0;

    //     return affectedRows;
    // }
}

module.exports = new NoteModel;
