const db = require('../db');

module.exports = async function validateCreate(table, data) {
    const errors = {};

    // Exemplo: regras genéricas para todos
    if (!data.nome || data.nome.trim() === '') {
        errors.nome = 'Nome é obrigatório';
    }
    if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        errors.email = 'Email inválido';
    }

    // Exemplo de regra específica por tabela
    if (table === 'clientes') {
        // Verifica se email já existe
        const emailExists = await new Promise(resolve => {
            db.query('SELECT id FROM clientes WHERE email = ?', [data.email], (err, results) => {
                if (err) return resolve(false);
                resolve(results.length > 0);
            });
        });
        if (emailExists) {
            errors.email = 'Email já cadastrado';
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
};
