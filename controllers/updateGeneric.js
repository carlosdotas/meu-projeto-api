const db = require('../db');
const { parseBody, loadValidator, checkAndAddMissingColumns } = require('./genericHelpers');
const { saveUploadedFile } = require('./uploadHelper');

async function updateGeneric(req, res) {
    const table = req.params.table;
    const id = req.params.id;
    let data = parseBody(req.body);

    // Suporte a upload de múltiplos arquivos (campos dinâmicos)
    if (Array.isArray(req.files)) {
        req.files.forEach(file => {
            // Permitir múltiplos arquivos por campo
            if (data[file.fieldname]) {
                if (!Array.isArray(data[file.fieldname])) {
                    data[file.fieldname] = [data[file.fieldname]];
                }
                data[file.fieldname].push(file.buffer);
                if (!Array.isArray(data[`${file.fieldname}_name`])) {
                    data[`${file.fieldname}_name`] = [data[`${file.fieldname}_name`]];
                }
                data[`${file.fieldname}_name`].push(file.originalname);
            } else {
                data[file.fieldname] = [file.buffer];
                data[`${file.fieldname}_name`] = [file.originalname];
            }
        });
    } else if (req.file) {
        data[req.file.fieldname] = [req.file.buffer];
        data[`${req.file.fieldname}_name`] = [req.file.originalname];
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Dados para atualização são obrigatórios' });
    }

    // 1. Tenta carregar o esquema de validação de UPDATE
    const validate = loadValidator(table, 'Update');

    // 2. Se tiver validação, executa
    if (typeof validate === 'function') {
        const result = await validate(data, id); // Pode usar o ID se precisar
        if (!result.valid) {
            return res.status(400).json({ error: 'Validação falhou', details: result.errors });
        }
    }

    try {
        // 3. Verificar se a tabela existe (não pode criar tabela nova)
        const tables = await db.queryAsync(`SHOW TABLES LIKE ?`, [table]);
        if (tables.length === 0) {
            return res.status(400).json({ error: `Tabela '${table}' não existe` });
        }
        // 4. Ajusta colunas faltantes e atualiza com filhos
        await checkAndAddMissingColumns(db, table, data);
        await updateWithChildren(table, id, data, res);
    } catch (err) {
        console.error('[updateGeneric]', err);
        return res.status(500).json({ error: 'Erro interno ao atualizar', details: err.message });
    }
}

// Atualiza dados e filhos recursivamente
async function updateWithChildren(table, id, data, res) {
    // Separa filhos dos dados do pai
    let children = [];
    let parentData = { ...data };
    for (const key in data) {
        if (Array.isArray(data[key]) && data[key].length && typeof data[key][0] === 'object') {
            children.push({ table: key, rows: data[key], parentKey: `id_${table}` });
            delete parentData[key];
        } else if (data[key] && typeof data[key] === 'object' && !Buffer.isBuffer(data[key])) {
            children.push({ table: key, rows: [data[key]], parentKey: `id_${table}` });
            delete parentData[key];
        }
    }
    // Atualiza o registro pai
    const fields = Object.keys(parentData).map(key => `\`${key}\` = ?`).join(', ');
    const values = Object.values(parentData);
    const sql = `UPDATE \`${table}\` SET ${fields} WHERE id = ?`;
    try {
        const result = await db.queryAsync(sql, [...values, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro não encontrado' });
        }
    } catch (err) {
        console.error('[updateWithChildren]', err);
        return res.status(500).json({ error: 'Erro ao atualizar registro', details: err.message });
    }
    // Atualiza ou insere filhos
    for (const child of children) {
        let key = child.parentKey;
        let childRows = child.rows;
        for (const row of childRows) {
            row[key] = id;
            // Se tiver id, faz update; senão, insere
            if (row.id) {
                // Atualiza filho
                await updateWithChildren(child.table, row.id, row, res);
            } else {
                // Garante tabela e colunas
                await new Promise((resolve, reject) => {
                    db.query(`SHOW TABLES LIKE ?`, [child.table], (err, results) => {
                        if (err) return reject(err);
                        if (results.length === 0) {
                            // Cria tabela
                            let cols = Object.keys(row).map(k => Buffer.isBuffer(row[k]) ? `\`${k}\` LONGBLOB` : typeof row[k] === 'number' ? `\`${k}\` INT` : `\`${k}\` VARCHAR(255)`);
                            cols.unshift('id INT AUTO_INCREMENT PRIMARY KEY');
                            if (!cols.some(c => c.includes(key))) cols.push(`\`${key}\` INT`);
                            const sqlCreate = `CREATE TABLE \`${child.table}\` (${cols.join(',')})`;
                            db.query(sqlCreate, (err) => { if (err) reject(err); else resolve(); });
                        } else { resolve(); }
                    });
                });
                // Garante colunas
                await new Promise((resolve, reject) => {
                    checkAndAddMissingColumns(db, child.table, row, res, (err) => { if (err) reject(err); else resolve(); });
                });
                // Remove campos que são objetos/arrays antes do insert
                let filteredRow = {};
                Object.keys(row).forEach(k => {
                    if (
                        typeof row[k] === 'string' ||
                        typeof row[k] === 'number' ||
                        typeof row[k] === 'boolean' ||
                        row[k] === null ||
                        Buffer.isBuffer(row[k])
                    ) {
                        filteredRow[k] = row[k];
                    }
                });
                // Padroniza campos entre todos os filhos: filtra todos para só primitivos
                const filteredChildRows = childRows.map(r => {
                    let obj = {};
                    Object.keys(r).forEach(k => {
                        if (
                            typeof r[k] === 'string' ||
                            typeof r[k] === 'number' ||
                            typeof r[k] === 'boolean' ||
                            r[k] === null ||
                            Buffer.isBuffer(r[k])
                        ) {
                            obj[k] = r[k];
                        }
                    });
                    return obj;
                });
                // Garante que todos tenham as mesmas colunas
                const allFieldsSet = new Set();
                filteredChildRows.forEach(obj => Object.keys(obj).forEach(k => allFieldsSet.add(k)));
                const flds = Array.from(allFieldsSet);
                // Preenche os valores para o filho a ser inserido
                const insertRow = flds.map(f => typeof filteredRow[f] === 'undefined' ? null : filteredRow[f]);
                const sqlIns = `INSERT INTO \`${child.table}\` (${flds.map(k=>`\`${k}\``).join(',')}) VALUES (${flds.map(()=>'?').join(',')})`;
                await new Promise((resolve, reject) => {
                    db.query(sqlIns, insertRow, (err) => { if (err) reject(err); else resolve(); });
                });
            }
        }
    }
    // (Opcional: remover filhos não enviados)
    res.status(200).json({ message: 'Registro atualizado com sucesso' });
}

module.exports = updateGeneric;
