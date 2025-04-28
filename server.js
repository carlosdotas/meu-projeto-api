const express = require('express');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const port = 3000;

const createGeneric = require('./controllers/createGeneric');
const updateGeneric = require('./controllers/updateGeneric');
const listAllGeneric = require('./controllers/listAllGeneric');
const deleteGeneric = require('./controllers/deleteGeneric');
const getOneGeneric = require('./controllers/getOneGeneric'); // 👈 Importar
const downloadFile = require('./controllers/downloadFile');
const getFile = require('./controllers/getFile');

app.use(express.json());

// CORS: Aceita requisições de qualquer origem
app.use(cors());

// Ou, para controle manual:
// app.use((req, res, next) => {
//     res.header('Access-Control-Allow-Origin', '*');
//     res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
//     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//     next();
// });

// Rotas genéricas
app.post('/:table', upload.any(), createGeneric);
app.put('/:table/:id', upload.any(), updateGeneric);
app.get('/:table/:id', getOneGeneric); // 👈 Novo GET de 1 registro
app.get('/:table', listAllGeneric);
app.delete('/:table/:id', deleteGeneric);
app.delete('/:table', deleteGeneric);

// Rota para download de arquivo
app.get('/:table/download/:field/:id', downloadFile);
// Rota para obter arquivo binário direto
app.get('/:table/getfile/:field/:idNome', getFile);

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
