const db = require('../db');
const { parseBody, loadValidator, checkAndAddMissingColumns } = require('./genericHelpers');
const { saveUploadedFile } = require('./uploadHelper');

async function createGeneric(req, res) {
    const table = req.params.table;
    let data = parseBody(req.body);

    // Permitir array de objetos para inserção em lote
    let isBatch = Array.isArray(data);
    let dataArray = isBatch ? data : [data];

    // Suporte a upload de múltiplos arquivos (campos dinâmicos)
    if (Array.isArray(req.files)) {
        req.files.forEach(file => {
            if (dataArray.every(row => row[file.fieldname])) {
                dataArray.forEach(row => {
                    if (!Array.isArray(row[file.fieldname])) {
                        row[file.fieldname] = [row[file.fieldname]];
                    }
                    row[file.fieldname].push(file.buffer);
                    if (!Array.isArray(row[`${file.fieldname}_name`])) {
                        row[`${file.fieldname}_name`] = [row[`${file.fieldname}_name`]];
                    }
                    row[`${file.fieldname}_name`].push(file.originalname);
                });
            } else {
                dataArray.forEach(row => {
                    row[file.fieldname] = [file.buffer];
                    row[`${file.fieldname}_name`] = [file.originalname];
                });
            }
        });
    } else if (req.file) {
        dataArray.forEach(row => {
            row[req.file.fieldname] = [req.file.buffer];
            row[`${req.file.fieldname}_name`] = [req.file.originalname];
        });
    }

    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0 || typeof dataArray[0] !== 'object') {
        return res.status(400).json({ error: 'Dados para criação são obrigatórios' });
    }

    const validate = loadValidator(table, 'Create');

    if (validate) {
        const valid = dataArray.every(row => validate(row));
        if (!valid) {
            return res.status(400).json({ error: 'Validação falhou', details: validate.errors });
        }
    }

    try {
        // Cria tabela principal se não existir
        const tables = await db.queryAsync(`SHOW TABLES LIKE ?`, [table]);
        if (tables.length === 0) {
            const sample = dataArray[0];
            const cols = Object.keys(sample).map(key => {
                if (Buffer.isBuffer(sample[key])) return `\`${key}\` LONGBLOB`;
                if (typeof sample[key] === 'number') return `\`${key}\` INT`;
                if (typeof sample[key] === 'boolean') return `\`${key}\` TINYINT(1)`;
                return `\`${key}\` VARCHAR(255)`;
            });
            cols.unshift('id INT AUTO_INCREMENT PRIMARY KEY');
            const sqlCreate = `CREATE TABLE \`${table}\` (${cols.join(',')})`;
            await db.queryAsync(sqlCreate);
        }
        // Ajusta colunas faltantes
        await checkAndAddMissingColumns(db, table, dataArray[0]);
        // Insere registros com filhos recursivamente
        await insertWithChildren(table, dataArray, null, res);
    } catch (err) {
        console.error('[createGeneric]', err);
        return res.status(500).json({ error: 'Erro interno ao criar registros', details: err.message });
    }
}

async function insertWithChildren(table, dataArray, parentId, res) {
    try {
        // Garante tabela e colunas
        const tables = await db.queryAsync(`SHOW TABLES LIKE ?`, [table]);
        if (tables.length === 0) {
            const sample = dataArray[0];
            const cols = Object.keys(sample).map(key => {
                if (Buffer.isBuffer(sample[key])) return `\`${key}\` LONGBLOB`;
                if (typeof sample[key] === 'number') return `\`${key}\` INT`;
                if (typeof sample[key] === 'boolean') return `\`${key}\` TINYINT(1)`;
                return `\`${key}\` VARCHAR(255)`;
            });
            cols.unshift('id INT AUTO_INCREMENT PRIMARY KEY');
            if (parentId && !cols.some(c => c.includes(parentId.key))) {
                cols.push(`\`${parentId.key}\` INT`);
            }
            const sqlCreate = `CREATE TABLE \`${table}\` (${cols.join(',')})`;
            await db.queryAsync(sqlCreate);
        }
        await checkAndAddMissingColumns(db, table, dataArray[0]);
        if (parentId && !Object.keys(dataArray[0]).includes(parentId.key)) {
            const alter = `ALTER TABLE \`${table}\` ADD COLUMN \`${parentId.key}\` INT`;
            await db.queryAsync(alter);
            dataArray.forEach(row => { row[parentId.key] = parentId.value; });
        }
    } catch (err) {
        throw err;
    }

    let children = [];
    let parentDataArray = dataArray.map(row => {
        let rowCopy = {};
        for (const key in row) {
            if (Array.isArray(row[key]) && row[key].length && typeof row[key][0] === 'object') {
                children.push({ table: key, rows: row[key], parentKey: `id_${table}` });
            } else if (row[key] && typeof row[key] === 'object' && !Buffer.isBuffer(row[key])) {
                children.push({ table: key, rows: [row[key]], parentKey: `id_${table}` });
            } else if (
                typeof row[key] === 'string' ||
                typeof row[key] === 'number' ||
                typeof row[key] === 'boolean' ||
                row[key] === null ||
                Buffer.isBuffer(row[key])
            ) {
                rowCopy[key] = row[key];
            }
        }
        return rowCopy;
    });

    const allFieldsSet = new Set();
    parentDataArray.forEach(row => {
        Object.keys(row).forEach(k => allFieldsSet.add(k));
    });
    const fields = Array.from(allFieldsSet);
    parentDataArray = parentDataArray.map(row => {
        const newRow = {};
        fields.forEach(f => {
            newRow[f] = typeof row[f] === 'undefined' ? null : row[f];
        });
        return newRow;
    });

    const sql = `INSERT INTO \`${table}\` (${fields.map(k => `\`${k}\``).join(',')}) VALUES ${parentDataArray.map(() => `(${fields.map(() => '?').join(',')})`).join(',')}`;
    const params = parentDataArray.flatMap(row => fields.map(f => row[f]));
    const insertResult = await db.queryAsync(sql, params);

    let parentIds = [];
    if (insertResult.insertId && insertResult.affectedRows) {
        for (let i = 0; i < insertResult.affectedRows; i++) {
            parentIds.push(insertResult.insertId + i);
        }
    }

    for (const child of children) {
        let key = child.parentKey;
        let childRows = child.rows;
        childRows.forEach((r, idx) => {
            r[key] = parentIds[idx] || parentIds[0];
            for (const subkey in r) {
                if (Array.isArray(r[subkey]) && r[subkey].length && typeof r[subkey][0] === 'object') {
                    r[subkey].forEach(subitem => {
                        subitem[key] = r[key];
                    });
                } else if (r[subkey] && typeof r[subkey] === 'object' && !Buffer.isBuffer(r[subkey])) {
                    r[subkey][key] = r[key];
                }
            }
        });
        await insertWithChildren(child.table, childRows, { key, value: parentIds[0] }, res);
    }

    if (!parentId) {
        res.status(201).json({ message: 'Registros criados com sucesso', table, inserted: insertResult.affectedRows, ids: parentIds });
    }
}

module.exports = createGeneric;
