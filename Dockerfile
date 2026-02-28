FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci && chown -R node:node /app

# Copy built app and source
COPY --chown=node:node .next .next
COPY --chown=node:node public public
COPY --chown=node:node src src
COPY --chown=node:node next.config.ts tsconfig.json ./

EXPOSE 3001

USER node

CMD ["npm", "start"]
