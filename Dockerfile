FROM node:18-alpine
WORKDIR /app
RUN npm install express socket.io
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
