FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Konteyner ishga tushganda: kompilyatsiya qilingan seed (ts-node 512 MB xotiraga sig'maydi) (SUPERADMIN va bo'sh bazada demo ma'lumot — takroriy
# ishga tushirishda hech narsani o'chirmaydi), so'ng server.
CMD sh -c "(node dist/prisma/seed.js || true) && node dist/src/main"
