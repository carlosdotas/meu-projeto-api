const db = require('../db');

async function listAllGeneric(req, res) {
    const table = req.params.table;
    const query = req.query;

    // 1. Verificar se a tabela existe
    db.query(`SHOW TABLES LIKE ?`, [table], (err, tables) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao verificar tabela', details: err.message });
        }

        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }

        // 2. Buscar campos da tabela
        db.query(`SHOW COLUMNS FROM \`${table}\``, (err, columns) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar colunas', details: err.message });
            }

            const allFields = columns.map(col => col.Field);

            // 3. Construir filtros
            let whereClauses = [];
            let values = [];

            for (const rawKey in query) {
                if (['page', 'limit', 'sort', 'q', 'fields'].includes(rawKey)) {
                    continue; // pular controles
                }

                const value = query[rawKey];
                let key = rawKey;
                let operator = '=';

                if (rawKey.includes('|')) {
                    const parts = rawKey.split('|');
                    key = parts[0];
                    operator = parts[1];
                } else if (typeof value === 'string' && value.includes('%')) {
                    operator = 'LIKE';
                }

                whereClauses.push(`\`${key}\` ${operator} ?`);
                values.push(value);
            }

            // 4. Full-Text search (q=...)
            if (query.q) {
                const searchTerms = allFields.map(field => `\`${field}\` LIKE ?`).join(' OR ');
                const searchValues = allFields.map(() => `%${query.q}%`);
                whereClauses.push(`(${searchTerms})`);
                values.push(...searchValues);
            }

            const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // 5. Selecionar campos específicos
            let fieldsSQL = '*';
            if (query.fields) {
                const selectedFields = query.fields.split(',').map(f => `\`${f.trim()}\``);
                fieldsSQL = selectedFields.join(', ');
            }

            // 6. Ordenação
            let orderSQL = '';
            if (query.sort) {
                const [sortField, sortDir = 'asc'] = query.sort.split('|');
                if (allFields.includes(sortField)) {
                    orderSQL = `ORDER BY \`${sortField}\` ${sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
                }
            }

            // 7. Paginação
            let limitSQL = '';
            if (query.page && query.limit) {
                const page = parseInt(query.page, 10) || 1;
                const limit = parseInt(query.limit, 10) || 10;
                const offset = (page - 1) * limit;
                limitSQL = `LIMIT ${limit} OFFSET ${offset}`;
            }

            // 8. Montar SQL final
            const sql = `SELECT ${fieldsSQL} FROM \`${table}\` ${whereSQL} ${orderSQL} ${limitSQL}`;

            db.query(sql, values, (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao buscar registros', details: err.message });
                }

                res.status(200).json(rows);
            });
        });
    });
}

module.exports = listAllGeneric;
