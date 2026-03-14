FROM node:18.19.0-alpine3.19 AS runtime

RUN apk add --no-cache ffmpeg

WORKDIR /usr/src/app

COPY ./src/package.json ./package.json
COPY ./src/package-lock.json ./package-lock.json
RUN npm install --omit=dev

COPY ./src .
COPY ./docs ./docs

EXPOSE 3000

CMD ["node", "app.js"]

