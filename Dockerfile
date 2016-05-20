FROM node:4.4.4-slim

# Install Factorio
ENV FACTORIO_VERSION 0.12.33
RUN cd /usr/local && \
curl -sL "http://www.factorio.com/get-download/${FACTORIO_VERSION}/headless/linux64" \
| tar xzv

# Install admin app
ADD assets/app/package.json /app/package.json
WORKDIR /app
RUN npm install --production
ADD assets /

EXPOSE 8000
EXPOSE 34197/udp
VOLUME /usr/local/factorio/saves

CMD node /app
