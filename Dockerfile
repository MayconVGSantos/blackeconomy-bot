# Etapa 1: Build base com Node.js
FROM node:18-slim

# Define diretório de trabalho
WORKDIR /app

# Copia apenas arquivos essenciais primeiro (para aproveitar cache)
COPY package*.json ./

# Instala dependências
RUN npm install --production

# Copia o restante do código
COPY . .

# Torna o script de inicialização executável
RUN chmod +x start.sh

# Expõe a porta usada pela aplicação
EXPOSE 8080

# Comando de inicialização do bot usando o script
CMD ["./start.sh"]
