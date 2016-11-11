FROM node:4.6.1-slim
MAINTAINER Jesse Clark <docker@jessejohnclark.com>

# Install Factorio
ENV FACTORIO_VERSION 0.14.20
RUN cd /usr/local && \
curl -sL "http://www.factorio.com/get-download/${FACTORIO_VERSION}/headless/linux64" \
| tar xzv && \
printf '#!/bin/sh\n/usr/local/factorio/bin/x64/factorio $@\n' > /usr/local/bin/factorio && \
chmod +x /usr/local/bin/factorio

# Install app
ADD package.json /app/package.json
WORKDIR /app
RUN npm install --silent --production
ADD . /app

# Set environment
ENV PORT 8000
EXPOSE 8000

ENV FACTORIO_PORT 34197
EXPOSE 34197/udp

VOLUME /usr/local/factorio/saves
VOLUME /usr/local/factorio/mods

CMD node /app
