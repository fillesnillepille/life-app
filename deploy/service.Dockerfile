FROM node:24-alpine
WORKDIR /app
COPY service/package.json service/package-lock.json ./
RUN npm ci --omit=dev
COPY service/src ./src
# Credentials come from the environment (see deploy/docker-compose.yml), never from the image.
USER node
CMD ["node", "src/index.ts"]
