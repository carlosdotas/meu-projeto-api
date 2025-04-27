const db = require('../db'); // Precisamos do banco para checar o e-mail

module.exports = function validateCliente(data) {
    return new Promise((resolve) => {
        const errors = {};

        if (!data.nome || data.nome.trim() === '') {
            errors.nome = 'Nome é obrigatório';
        }

        if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
            errors.email = 'Email inválido';
        }

        if (Object.keys(errors).length > 0) {
            return resolve({ valid: false, errors });
        }

        // Consultar se email já existe no banco
        db.query('SELECT id FROM clientes WHERE email = ?', [data.email], (err, results) => {
            if (err) {
                // Se der erro na consulta, considera válido para não travar tudo
                console.error('Erro ao consultar email único:', err.message);
                return resolve({ valid: true });
            }

            if (results.length > 0) {
                errors.email = 'Email já cadastrado';
                return resolve({ valid: false, errors });
            }

            resolve({ valid: true });
        });
    });
};
