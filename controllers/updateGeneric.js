const db = require('../db');
const path = require('path');

async function updateGeneric(req, res) {
    const table = req.params.table;
    const id = req.params.id;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Dados para atualização são obrigatórios' });
    }

    // 1. Tenta carregar o esquema de validação de UPDATE
    let validate;
    try {
        validate = require(path.join('../validations', table, 'validateUpdate'));
    } catch (err) {
        validate = null; // Sem validação para esta tabela
    }

    // 2. Se tiver validação, executa
    if (validate) {
        const result = await validate(data, id); // Pode usar o ID se precisar
        if (!result.valid) {
            return res.status(400).json({ error: 'Validação falhou', details: result.errors });
        }
    }

    // 3. Verificar se a tabela existe (não pode criar tabela nova)
    db.query(`SHOW TABLES LIKE ?`, [table], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar tabela', details: err.message });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }

        // 4. Verificar se existem as colunas
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
                    updateData(table, id, data, res);
                });
            } else {
                updateData(table, id, data, res);
            }
        });
    });
}

// Atualiza os dados
function updateData(table, id, data, res) {
    const fields = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
    const values = Object.values(data);

    const sql = `UPDATE \`${table}\` SET ${fields} WHERE id = ?`;

    db.query(sql, [...values, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao atualizar registro', details: err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }

        res.status(200).json({ message: 'Registro atualizado com sucesso' });
    });
}

module.exports = updateGeneric;
