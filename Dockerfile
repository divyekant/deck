FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built app and source
COPY .next .next
COPY public public
COPY src src
COPY next.config.ts tsconfig.json ./

EXPOSE 3001

CMD ["npm", "start"]
