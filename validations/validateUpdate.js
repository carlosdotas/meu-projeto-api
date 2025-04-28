const db = require('../db');

module.exports = async function validateUpdate(table, data, id) {
    const errors = {};

    // Exemplo: regras genéricas
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        errors.email = 'Email inválido';
    }

    // Exemplo de regra específica por tabela
    if (table === 'clientes' && data.email) {
        // Verifica se email já existe para outro usuário
        const emailExists = await new Promise(resolve => {
            db.query('SELECT id FROM clientes WHERE email = ? AND id != ?', [data.email, id], (err, results) => {
                if (err) return resolve(false);
                resolve(results.length > 0);
            });
        });
        if (emailExists) {
            errors.email = 'Email já cadastrado para outro cliente';
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
};
