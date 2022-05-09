const mysql = require('mysql2');

// docker
const dbConnection = mysql.createPool({
    host: 'mysql-db', // MYSQL HOST NAME
    user: 'root', // MYSQL USERNAME
    password: 'sanyabot42', // MYSQL PASSWORD
    database: 'member', // MYSQL DB NAME
    port: '3306',
}).promise();

// xampp
// const dbConnection = mysql.createPool({
//     host: 'localhost', // MYSQL HOST NAME
//     user: 'root', // MYSQL USERNAME
//     password: '', // MYSQL PASSWORD
//     database: 'member', // MYSQL DB NAME
// }).promise();

module.exports = dbConnection;