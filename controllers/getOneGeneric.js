const db = require('../db');

async function getOneGeneric(req, res) {
    const table = req.params.table;
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: 'ID obrigatório para buscar o registro' });
    }

    // 1. Verificar se a tabela existe
    db.query(`SHOW TABLES LIKE ?`, [table], (err, tables) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar tabela', details: err.message });
        }

        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }

        // 2. Buscar o registro pelo ID
        const sql = `SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`;

        db.query(sql, [id], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar registro', details: err.message });
            }

            if (rows.length === 0) {
                return res.status(404).json({ error: `Registro ID ${id} não encontrado na tabela '${table}'` });
            }

            res.status(200).json(rows[0]);
        });
    });
}

module.exports = getOneGeneric;
