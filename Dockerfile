FROM node:20-alpine AS build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server-node/package*.json ./
RUN npm install --production
COPY server-node/ ./
# Copy built client
COPY --from=build /app/client/dist ./public

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "index.js"]
