const express = require('express');
const app = express();
const port = 3000;

const createGeneric = require('./controllers/createGeneric');
const updateGeneric = require('./controllers/updateGeneric');
const listAllGeneric = require('./controllers/listAllGeneric');
const deleteGeneric = require('./controllers/deleteGeneric');
const getOneGeneric = require('./controllers/getOneGeneric'); // 👈 Importar

app.use(express.json());

// Rotas genéricas
app.post('/:table', createGeneric);
app.put('/:table/:id', updateGeneric);
app.get('/:table/:id', getOneGeneric); // 👈 Novo GET de 1 registro
app.get('/:table', listAllGeneric);
app.delete('/:table/:id', deleteGeneric);
app.delete('/:table', deleteGeneric);

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
