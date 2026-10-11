FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/algorithms/package.json ./packages/algorithms/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev
COPY apps/api ./apps/api
COPY packages/algorithms ./packages/algorithms
COPY packages/contracts ./packages/contracts
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "apps/api"]
