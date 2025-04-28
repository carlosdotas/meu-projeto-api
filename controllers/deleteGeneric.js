const db = require('../db');
const { checkAndAddMissingColumns } = require('./genericHelpers');

async function deleteGeneric(req, res) {
    const table = req.params.table;
    const identifier = req.params.id;
    const filters = req.query;

    if (!identifier && Object.keys(filters).length === 0) {
        return res.status(400).json({ error: 'É necessário passar um ID ou filtros para deletar' });
    }

    try {
        // 1. Verificar existência da tabela
        const tables = await db.queryAsync(`SHOW TABLES LIKE ?`, [table]);
        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }
        // 2. Montar filtros
        const whereClauses = [];
        const values = [];
        if (Object.keys(filters).length > 0) {
            for (const key in filters) {
                const value = filters[key];
                const operator = typeof value === 'string' && value.includes('%') ? 'LIKE' : '=';
                whereClauses.push(`\`${key}\` ${operator} ?`);
                values.push(value);
            }
        } else {
            whereClauses.push('`id` = ?');
            values.push(identifier);
        }
        const whereSQL = whereClauses.join(' AND ');
        // 3. Verificar existência do(s) registro(s)
        const checkSQL = `SELECT * FROM \`${table}\` WHERE ${whereSQL}`;
        const rows = await db.queryAsync(checkSQL, values);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum registro encontrado para o filtro fornecido' });
        }
        // 4. Deletar registro(s)
        const deleteSQL = `DELETE FROM \`${table}\` WHERE ${whereSQL}`;
        const result = await db.queryAsync(deleteSQL, values);
        res.status(200).json({ message: `Registros deletados: ${result.affectedRows}` });
    } catch (err) {
        console.error('[deleteGeneric]', err);
        res.status(500).json({ error: 'Erro ao deletar registro', details: err.message });
    }
}

module.exports = deleteGeneric;
