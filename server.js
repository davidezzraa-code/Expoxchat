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
let userNames = {}; 
let totalOnline = 0;

io.on('connection', (socket) => {
    totalOnline++;
    io.emit('update_online_count', totalOnline);

    socket.on('set_nickname', (name) => {
        userNames[socket.id] = name || "Stranger";
    });

    socket.on('find_stranger', () => {
        disconnectFromPartner(socket);
        if (waitingQueue.length > 0) {
            let partnerSocketId = waitingQueue.shift();
            if (io.sockets.sockets.get(partnerSocketId)) {
                activePairs[socket.id] = partnerSocketId;
                activePairs[partnerSocketId] = socket.id;
                
                socket.emit('chat_start', { partnerName: userNames[partnerSocketId] || "Stranger" });
                io.to(partnerSocketId).emit('chat_start', { partnerName: userNames[socket.id] || "Stranger" });
                return;
            }
        }
        waitingQueue.push(socket.id);
        socket.emit('waiting');
    });

    socket.on('request_friend', () => {
        let partnerId = activePairs[socket.id];
        if (partnerId) io.to(partnerId).emit('friend_request_received');
    });

    socket.on('deny_friend', () => {
        let partnerId = activePairs[socket.id];
        if (partnerId) io.to(partnerId).emit('friend_request_denied');
    });

    socket.on('accept_friend', () => {
        let partnerId = activePairs[socket.id];
        if (partnerId) {
            let code = "ID-" + Math.floor(1000 + Math.random() * 9000);
            socket.emit('friend_match_success', { friendCode: code, friendName: userNames[partnerId] || "Stranger" });
            io.to(partnerId).emit('friend_match_success', { friendCode: code, friendName: userNames[socket.id] || "Stranger" });
        }
    });

    socket.on('send_message', (msg) => {
        let partnerId = activePairs[socket.id];
        if (partnerId) io.to(partnerId).emit('receive_message', msg);
    });

    socket.on('send_image', (imgData) => {
        let partnerId = activePairs[socket.id];
        if (!partnerId) return;

        if (typeof imgData === 'string' && imgData.includes("data:image/")) {
            io.to(partnerId).emit('receive_image', imgData);
        } else {
            socket.emit('safety_alert', "🛡️ System Block: Invalid file type layout.");
        }
    });

    socket.on('disconnect', () => {
        totalOnline--;
        io.emit('update_online_count', totalOnline);
        disconnectFromPartner(socket);
        delete userNames[socket.id];
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

// FIXED: Binds the server to Render's dynamic host port configuration
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
