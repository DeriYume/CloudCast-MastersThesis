FROM node:22-alpine

# Run as the built-in unprivileged user, not root.
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.js ./

# Drop to a non-root user for defence in depth.
USER node

EXPOSE 7000
CMD ["node", "index.js"]
