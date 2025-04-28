const db = require('../../db');

module.exports = function validateUpdateCliente(data, id) {
    return new Promise((resolve) => {
        const errors = {};

        // No UPDATE, nada é obrigatório, mas se mandar email deve ser válido
        if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
            errors.email = 'Email inválido';
        }

        if (Object.keys(errors).length > 0) {
            return resolve({ valid: false, errors });
        }

        // Se mandou um email novo, verificar se ele já existe em outro usuário
        if (data.email) {
            db.query('SELECT id FROM clientes WHERE email = ? AND id != ?', [data.email, id], (err, results) => {
                if (err) {
                    console.error('Erro ao consultar email único no update:', err.message);
                    return resolve({ valid: true });
                }

                if (results.length > 0) {
                    errors.email = 'Email já cadastrado para outro cliente';
                    return resolve({ valid: false, errors });
                }

                resolve({ valid: true });
            });
        } else {
            resolve({ valid: true }); // Não mandou email, valida direto
        }
    });
};
