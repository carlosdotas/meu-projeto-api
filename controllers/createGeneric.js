const db = require('../db');
const path = require('path');

async function createGeneric(req, res) {
    const table = req.params.table;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Dados são obrigatórios' });
    }

    // 1. Tenta carregar o esquema de validação para criação
    let validate;
    try {
        validate = require(path.join('../validations', table, 'validateCreate'));
    } catch (err) {
        validate = null; // Sem validação para esta tabela
    }

    // 2. Se tiver validação, executa
    if (validate) {
        const result = await validate(data);
        if (!result.valid) {
            return res.status(400).json({ error: 'Validação falhou', details: result.errors });
        }
    }

    // 3. Verificar se a tabela existe
    db.query(`SHOW TABLES LIKE ?`, [table], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar tabela', details: err.message });
        }

        if (results.length === 0) {
            // Se não existe, cria
            const columns = Object.keys(data).map(key => `\`${key}\` VARCHAR(255)`).join(', ');
            const createTableSQL = `
                CREATE TABLE \`${table}\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ${columns}
                )
            `;

            db.query(createTableSQL, (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao criar tabela', details: err.message });
                }
                insertData(table, data, res);
            });

        } else {
            // Se existe, checa se falta alguma coluna
            db.query(`SHOW COLUMNS FROM \`${table}\``, (err, columns) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao verificar colunas', details: err.message });
                }

                const existingColumns = columns.map(col => col.Field);
                const missingColumns = Object.keys(data).filter(key => !existingColumns.includes(key));

                if (missingColumns.length > 0) {
                    const alterQueries = missingColumns.map(col => `ADD COLUMN \`${col}\` VARCHAR(255)`).join(', ');
                    const alterSQL = `ALTER TABLE \`${table}\` ${alterQueries}`;

                    db.query(alterSQL, (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Erro ao adicionar colunas', details: err.message });
                        }
                        insertData(table, data, res);
                    });
                } else {
                    insertData(table, data, res);
                }
            });
        }
    });
}

function insertData(table, data, res) {
    const fields = Object.keys(data).map(key => `\`${key}\``).join(', ');
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(', ');

    const sql = `INSERT INTO \`${table}\` (${fields}) VALUES (${placeholders})`;

    db.query(sql, values, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao inserir dado', details: err.message });
        }
        res.status(201).json({ id: result.insertId, ...data });
    });
}

module.exports = createGeneric;
