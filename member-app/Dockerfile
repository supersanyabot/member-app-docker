FROM node:16.15-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD [ "npm", "start"]