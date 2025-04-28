const db = require('../db');

// Rota: /:table/download/:field/:id
async function downloadFile(req, res) {
    const { table, field, id } = req.params;
    if (!table || !field || !id) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: table, field, id' });
    }
    try {
        // Busca o registro
        const rows = await db.queryAsync(
            `SELECT \`${field}\`, \`${field}_name\` FROM \`${table}\` WHERE id = ? LIMIT 1`,
            [id]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: `Registro id ${id} não encontrado em ${table}` });
        }
        const fileBuffer = rows[0][field];
        const fileName = rows[0][`${field}_name`] || 'arquivo';
        if (!fileBuffer) {
            return res.status(404).json({ error: `Arquivo não encontrado no campo '${field}'` });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(fileBuffer);
    } catch (err) {
        console.error('[downloadFile]', err);
        res.status(500).json({ error: 'Erro ao buscar registro', details: err.message });
    }
}

module.exports = downloadFile;
