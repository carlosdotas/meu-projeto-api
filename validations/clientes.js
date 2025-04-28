const db = require('../db'); // Precisamos do banco para checar o e-mail

module.exports = {
    async validateCreate(data) {
        const errors = {};
        if (!data.nome || data.nome.trim() === '') {
            errors.nome = 'Nome é obrigatório';
        }
        if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
            errors.email = 'Email inválido';
        }
        if (Object.keys(errors).length > 0) {
            return { valid: false, errors };
        }
        // Checa se email já existe
        const emailExists = await new Promise(resolve => {
            db.query('SELECT id FROM clientes WHERE email = ?', [data.email], (err, results) => {
                if (err) return resolve(false);
                resolve(results.length > 0);
            });
        });
        if (emailExists) {
            errors.email = 'Email já cadastrado';
        }
        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    },
    async validateUpdate(data, id) {
        const errors = {};
        // No update, email é opcional, mas se vier deve ser válido
        if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
            errors.email = 'Email inválido';
        }
        if (Object.keys(errors).length > 0) {
            return { valid: false, errors };
        }
        // Se mandou email, checa duplicidade para outro id
        if (data.email) {
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
    }
};
