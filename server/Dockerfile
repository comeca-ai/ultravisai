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

# Container roda como non-root (node, uid 1000, já existe na imagem base).
# node:20 escuta na porta 80 (contrato do PORT default do server.js e do
# worker Cloudflare) — porta <1024 exige a capability abaixo pro binário
# node, já que o processo não é mais root.
RUN apt-get update && apt-get install -y --no-install-recommends libcap2-bin \
    && setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")" \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /ansvisor-server

USER node

EXPOSE 80

CMD ["pm2-runtime", "start", "src/server.js"]
