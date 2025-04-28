const db = require('../db');
const { checkAndAddMissingColumns } = require('./genericHelpers');

async function listAllGeneric(req, res) {
    const table = req.params.table;
    const query = req.query;

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

        // 3. Construir cláusulas WHERE
        const whereClauses = [];
        const values = [];
        for (const rawKey in query) {
            if (['page', 'limit', 'sort', 'q', 'fields'].includes(rawKey)) continue;
            const value = query[rawKey];
            let key = rawKey, operator = '=';
            if (rawKey.includes('|')) {
                [key, operator] = rawKey.split('|');
            } else if (typeof value === 'string' && value.includes('%')) {
                operator = 'LIKE';
            }
            whereClauses.push(`\`${key}\` ${operator} ?`);
            values.push(value);
        }
        // Full-text
        if (query.q) {
            const terms = allFields.map(f => `\`${f}\` LIKE ?`).join(' OR ');
            whereClauses.push(`(${terms})`);
            allFields.forEach(() => values.push(`%${query.q}%`));
        }
        const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Ordenação e paginação
        let orderSQL = '';
        if (query.sort) {
            const [sf, sd = 'asc'] = query.sort.split('|');
            if (visibleFields.includes(sf)) orderSQL = `ORDER BY \`${sf}\` ${sd.toUpperCase()==='DESC'?'DESC':'ASC'}`;
        }
        let limitSQL = '';
        if (query.page && query.limit) {
            const p = parseInt(query.page,10)||1;
            const l = parseInt(query.limit,10)||10;
            limitSQL = `LIMIT ${l} OFFSET ${(p-1)*l}`;
        }

        // Seleção final
        const fieldsSQL = visibleFields.map(f => `\`${f}\``).join(', ');
        const sql = `SELECT ${fieldsSQL} FROM \`${table}\` ${whereSQL} ${orderSQL} ${limitSQL}`;
        const rows = await db.queryAsync(sql, values);
        res.status(200).json(rows);
    } catch (err) {
        console.error('[listAllGeneric]', err);
        res.status(500).json({ error: 'Erro ao buscar registros', details: err.message });
    }
}

module.exports = listAllGeneric;
