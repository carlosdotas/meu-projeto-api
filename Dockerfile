# 1. Usar imagem oficial Node.js
FROM node:20

# 2. Criar diretório da aplicação
WORKDIR /app

# 3. Copiar package.json e package-lock.json (se tiver)
COPY package*.json ./

# 4. Instalar dependências
RUN npm install

# 5. Copiar o restante do projeto
COPY . .

# 6. Expor a porta (igual no server.js)
EXPOSE 3000

# 7. Comando para iniciar o servidor
CMD ["npm", "start"]
