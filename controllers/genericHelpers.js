const path = require('path');

// Garante que o body seja um objeto
function parseBody(data) {
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (err) {
            // Mantém como string se não for JSON válido
        }
    }
    return data;
}

// Carrega dinamicamente o validador (create/update) para a tabela
const fs = require('fs');

function loadValidator(table, type) {
    // Novo padrão: validations/<table>.js
    const validatorPath = path.join(__dirname, '../validations', `${table}.js`);
    if (fs.existsSync(validatorPath)) {
        const validators = require(validatorPath);
        const fn = validators[`validate${type}`];
        if (typeof fn === 'function') {
            return fn;
        }
        return null;
    }
    // (Opcional: fallback para padrão antigo, se quiser)
    return null;
}

// Checa e adiciona colunas que não existem na tabela, depois chama o callback
/**
 * Verifica colunas existentes e adiciona as que faltam com base em data.
 * Lança erro em caso de falha.
 */
async function checkAndAddMissingColumns(db, table, data) {
    // Busca colunas existentes
    const columns = await db.queryAsync(`SHOW COLUMNS FROM \`${table}\``);
    const existing = columns.map(col => col.Field);
    const missing = Object.keys(data).filter(key => !existing.includes(key));
    if (missing.length === 0) return;
    // Monta alterações
    const alters = missing.map(col => {
        if (Buffer.isBuffer(data[col])) {
            console.log(`[SCHEMA] Criando coluna '${col}' como LONGBLOB`);
            return `ADD COLUMN \`${col}\` LONGBLOB`;
        }
        console.log(`[SCHEMA] Criando coluna '${col}' como VARCHAR(255)`);
        return `ADD COLUMN \`${col}\` VARCHAR(255)`;
    }).join(', ');
    const sql = `ALTER TABLE \`${table}\` ${alters}`;
    await db.queryAsync(sql);
}

module.exports = {
    parseBody,
    loadValidator,
    checkAndAddMissingColumns
};
