const query = require('./../db/db-connection');
const { multipleColumnSet } = require('./../utils/common.utils');
const Role = require('./../utils/userRoles.utils');

class UserModel {
    tableName = 'users';

    findOne = async (params) => {
        const { columnSet, values } = multipleColumnSet(params)

        const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

        const result = await query(sql, [...values]);

        // return back the first row (user)
        return result[0];
    }

    find = async () => {
        const sql = `SELECT * FROM ${this.tableName} WHERE 1`;

        const result = await query(sql);

        return result;
    }

    create = async (username, first_name, user_id) => {
        const sql = `INSERT INTO ${this.tableName}
        (username, first_name, user_id, role) VALUES (?,?,?,?)`;

        const result = await query(sql, [username, first_name, user_id, Role.SuperUser]);
        const affectedRows = result ? result.affectedRows : 0;

        return affectedRows;
    }
}

module.exports = new UserModel;
