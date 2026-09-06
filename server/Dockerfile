FROM node:20

ARG VERSION=0.1.0
LABEL org.opencontainers.image.title="Ansvisor Server"
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.source="https://github.com/ansvisor/ansvisor"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /ansvisor-server

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm install -g pm2

COPY . .

EXPOSE 80

CMD ["pm2-runtime", "start", "src/server.js"]
