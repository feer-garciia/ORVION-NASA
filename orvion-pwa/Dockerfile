# orvion-pwa/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Copiamos package.json y package-lock.json primero para aprovechar la caché
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código (aunque usaremos volúmenes en compose)
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# El flag --host 0.0.0.0 es OBLIGATORIO para que Codespaces/Docker pueda acceder
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]