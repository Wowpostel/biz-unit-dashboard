FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && npm install && npx prisma generate && npm run build
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
