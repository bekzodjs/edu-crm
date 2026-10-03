FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Konteyner ishga tushganda: seed (SUPERADMIN va bo'sh bazada demo ma'lumot — takroriy
# ishga tushirishda hech narsani o'chirmaydi), so'ng server.
CMD sh -c "(npm run seed || true) && npm run start:prod"
