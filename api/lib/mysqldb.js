/**
 * Created by lenovo on 2017/4/25.
 */
//引用模块
var mysql = require('mysql');

var mysqldb = {version: "0.0.1"};

mysqldb.params = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'mycrm'
};
//连接池
mysqldb.pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'mycrm'
});

mysqldb.isconnect = function (params, callback) {
    //对 params 进行数据存在校验
    mysqldb.pool = mysql.createPool({
        host: params.host,
        port: params.port,
        user: params.user,
        password: params.password,
        database: params.database
    });
};
mysqldb.isconnect = function (params, callback) {
};
//通用执行sql方法
mysqldb.query = function (sql, params, callback) {
    mysqldb.pool.getConnection(function (err, connection) {
        if (err) {

            if (callback) {
                callback(err);
            }
        } else {
            connection.query(sql, params, callback);
            connection.release();
        }
    });
};
module.exports = mysqldb;