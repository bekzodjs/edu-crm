FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD sh -c "npx prisma db push --accept-data-loss && (npm run seed || true) && npm run start:prod"
