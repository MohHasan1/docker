FROM node:26-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i --production
COPY ./ ./
EXPOSE 4000
CMD [ "node", "index.js" ]


