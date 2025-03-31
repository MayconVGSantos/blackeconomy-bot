# Usa imagem oficial do Node
FROM node:18

# Define diretório de trabalho
WORKDIR /app

# Copia apenas os arquivos essenciais primeiro (melhor cache)
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante do código
COPY . .

# Expõe a porta usada pelo bot
EXPOSE 8080

# Inicia o bot
CMD ["node", "index.js"]
