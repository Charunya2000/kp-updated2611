FROM docker-baseimages.devopsrepo.kp.org/nodesource/nsolid:v22-jod-debian-22.23.4

WORKDIR /app
COPY . .

ENV NODE_ENV=production
RUN npm install --omit=dev
RUN npm run build
RUN npm prune --omit=dev
RUN chown -R nsolid:nsolid /app

ENV PORT=8080
EXPOSE 8080

USER nsolid
CMD ["npm", "start"]

LABEL app='aiportal' TechnicalOwnerEmail='jonathan.b.seltzer@kp.org' Namespace='kp-hpts-aks-aisvc-dev'
