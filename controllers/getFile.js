const db = require('../db');

// Rota: /:table/getfile/:field/:idNome (ex: /usuarios/getfile/foto/1.jpg)
const path = require('path');
const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska'
};

async function getFile(req, res) {
    const { table, field, idNome } = req.params;
    if (!table || !field || !idNome) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: table, field, idNome' });
    }
    // Extrai id e extensão
    const match = idNome.match(/^(\d+)(\.[a-zA-Z0-9]+)$/);
    if (!match) {
        return res.status(400).json({ error: 'Formato de idNome inválido. Use /:table/getfile/:field/:id.ext' });
    }
    const id = match[1];
    const ext = match[2].toLowerCase();
    try {
        const rows = await db.queryAsync(
            `SELECT \`${field}\`, \`${field}_name\` FROM \`${table}\` WHERE id = ? LIMIT 1`,
            [id]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: `Registro id ${id} não encontrado em ${table}` });
        }
        const fileBuffer = rows[0][field];
        const fileName = rows[0][`${field}_name`] || '';
        if (!fileBuffer) {
            return res.status(404).json({ error: `Arquivo não encontrado no campo '${field}'` });
        }
        // Só permite se o nome salvo termina com a extensão requisitada
        if (!fileName.toLowerCase().endsWith(ext)) {
            return res.status(404).json({ error: `Arquivo não encontrado com a extensão requisitada` });
        }
        // Serve o arquivo com o tipo correto
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.send(fileBuffer);
    } catch (err) {
        console.error('[getFile]', err);
        res.status(500).json({ error: 'Erro ao buscar registro', details: err.message });
    }
}

module.exports = getFile;
