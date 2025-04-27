const db = require('../db');

async function deleteGeneric(req, res) {
    const table = req.params.table;
    const identifier = req.params.id;
    const filters = req.query;

    if (!identifier && Object.keys(filters).length === 0) {
        return res.status(400).json({ error: 'É necessário passar um ID ou filtros para deletar' });
    }

    // 1. Verificar se a tabela existe
    db.query(`SHOW TABLES LIKE ?`, [table], (err, tables) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar tabela', details: err.message });
        }

        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }

        // 2. Montar filtros
        let whereClauses = [];
        let values = [];

        if (Object.keys(filters).length > 0) {
            for (const key in filters) {
                const value = filters[key];
                let operator = '=';

                if (typeof value === 'string' && value.includes('%')) {
                    operator = 'LIKE';
                }

                whereClauses.push(`\`${key}\` ${operator} ?`);
                values.push(value);
            }
        } else {
            // Se não tiver filtro, usar o id no path
            whereClauses.push('`id` = ?');
            values.push(identifier);
        }

        const whereSQL = whereClauses.join(' AND ');

        // 3. Verificar se o registro existe
        const checkSQL = `SELECT * FROM \`${table}\` WHERE ${whereSQL}`;

        db.query(checkSQL, values, (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao verificar registro', details: err.message });
            }

            if (rows.length === 0) {
                return res.status(404).json({ error: `Nenhum registro encontrado para o filtro fornecido` });
            }

            // 4. Deletar registro(s)
            const deleteSQL = `DELETE FROM \`${table}\` WHERE ${whereSQL}`;

            db.query(deleteSQL, values, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao deletar registro', details: err.message });
                }

                res.status(200).json({ message: `Registros deletados: ${result.affectedRows}` });
            });
        });
    });
}

module.exports = deleteGeneric;
