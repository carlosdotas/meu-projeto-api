const db = require('../db');
const { checkAndAddMissingColumns } = require('./genericHelpers');

async function getOneGeneric(req, res) {
    const table = req.params.table;
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: 'ID obrigatório para buscar o registro' });
    }

    try {
        // 1. Verificar existência da tabela
        const tables = await db.queryAsync(`SHOW TABLES LIKE ?`, [table]);
        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }
        // 2. Obter colunas e filtrar LONGBLOB
        const columns = await db.queryAsync(`SHOW COLUMNS FROM \`${table}\``);
        const fieldsToHide = columns.filter(c => c.Type.toUpperCase().includes('LONGBLOB')).map(c => c.Field);
        const allFields = columns.map(c => c.Field);
        const visibleFields = allFields.filter(f => !fieldsToHide.includes(f));
        // 3. Buscar registro
        const fieldsSQL = visibleFields.map(f => `\`${f}\``).join(', ');
        const sql = `SELECT ${fieldsSQL} FROM \`${table}\` WHERE id = ? LIMIT 1`;
        const rows = await db.queryAsync(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: `Registro ID ${id} não encontrado na tabela '${table}'` });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('[getOneGeneric]', err);
        res.status(500).json({ error: 'Erro ao buscar registro', details: err.message });
    }
}

module.exports = getOneGeneric;
