FROM node:26-alpine as builder

WORKDIR '/app'
COPY ./package.json ./package-lock.json ./
RUN npm i
COPY ./ ./
RUN npm run build

FROM nginx:latest

EXPOSE 3000

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
