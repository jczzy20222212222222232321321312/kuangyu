FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server ./server
EXPOSE 10000
CMD ["node", "server/world-server.js"]
