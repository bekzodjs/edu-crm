FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

# Konteyner ishga tushganda: seed (birinchi admin + demo ma'lumot, idempotent), so'ng server.
# Mongoose sxemalari va indekslari ilova ishga tushganda avtomatik yaratiladi.
CMD sh -c "(npm run seed || true) && npm run start:prod"
