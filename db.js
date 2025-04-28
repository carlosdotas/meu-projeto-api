require('dotenv').config();
const mysql = require('mysql2');
const util = require('util');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'test'
});

db.connect((err) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados.');
    }
});
// Promisified methods for async/await usage
db.queryAsync = util.promisify(db.query).bind(db);
db.executeAsync = util.promisify(db.execute).bind(db);

module.exports = db;
