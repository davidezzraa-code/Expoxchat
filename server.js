const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7,
    cors: { origin: "*" }
});

app.use(express.static(__dirname + '/public'));

let waitingQueue = [];
let activePairs = {}; 
let totalOnline = 0;

io.on('connection', (socket) => {
    totalOnline++;
    io.emit('update_online_count', totalOnline);

    socket.on('find_stranger', () => {
        disconnectFromPartner(socket);
        if (waitingQueue.length > 0) {
            let partnerSocketId = waitingQueue.shift();
            if (io.sockets.sockets.get(partnerSocketId)) {
                activePairs[socket.id] = partnerSocketId;
                activePairs[partnerSocketId] = socket.id;
                socket.emit('chat_start');
                io.to(partnerSocketId).emit('chat_start');
                return;
            }
        }
        waitingQueue.push(socket.id);
        socket.emit('waiting');
    });

    socket.on('send_message', (msg) => {
        let partnerId = activePairs[socket.id];
        if (partnerId) io.to(partnerId).emit('receive_message', msg);
    });

    socket.on('send_image', (imgData) => {
        let partnerId = activePairs[socket.id];
        if (partnerId) io.to(partnerId).emit('receive_image', imgData);
    });

    socket.on('disconnect', () => {
        totalOnline--;
        io.emit('update_online_count', totalOnline);
        disconnectFromPartner(socket);
    });
});

function disconnectFromPartner(socket) {
    waitingQueue = waitingQueue.filter(id => id !== socket.id);
    let partnerId = activePairs[socket.id];
    if (partnerId) {
        io.to(partnerId).emit('partner_disconnected');
        delete activePairs[partnerId];
        delete activePairs[socket.id];
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
