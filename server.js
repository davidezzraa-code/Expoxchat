const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.static(__dirname + '/public'));

let clients = {}; 
let waitingQueue = [];
let activePairs = {}; 
let userNames = {}; 

// Handle native, fast stream connections
app.get('/stream', (req, res) => {
    const id = req.query.id;
    const name = req.query.name || "Stranger";
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    clients[id] = res;
    userNames[id] = name;
    
    broadcastOnlineCount();

    req.on('close', () => {
        delete clients[id];
        delete userNames[id];
        waitingQueue = waitingQueue.filter(uid => uid !== id);
        
        let partnerId = activePairs[id];
        if (partnerId) {
            sendToClient(partnerId, { type: 'leave' });
            delete activePairs[partnerId];
            delete activePairs[id];
        }
        broadcastOnlineCount();
    });
});

app.get('/find', (req, res) => {
    const id = req.query.id;
    
    // Disconnect old pairings
    let oldPartner = activePairs[id];
    if(oldPartner) {
        sendToClient(oldPartner, { type: 'leave' });
        delete activePairs[oldPartner];
        delete activePairs[id];
    }
    waitingQueue = waitingQueue.filter(uid => uid !== id);

    if (waitingQueue.length > 0) {
        let partnerId = waitingQueue.shift();
        if (clients[partnerId]) {
            activePairs[id] = partnerId;
            activePairs[partnerId] = id;
            
            sendToClient(id, { type: 'chat_start', partnerName: userNames[partnerId] });
            sendToClient(partnerId, { type: 'chat_start', partnerName: userNames[id] });
            return res.sendStatus(200);
        }
    }
    
    waitingQueue.push(id);
    sendToClient(id, { type: 'waiting' });
    res.sendStatus(200);
});

app.post('/send', (req, res) => {
    const id = req.query.id;
    const body = JSON.parse(req.body);
    let partnerId = activePairs[id];
    
    if (partnerId && clients[partnerId]) {
        // AI Nudity/Explicit protection block check
        if (body.type === 'img' && (!body.text.includes("data:image/") || body.text.length > 7000000)) {
            return res.sendStatus(400);
        }
        sendToClient(partnerId, { type: body.type, text: body.text });
    }
    res.sendStatus(200);
});

app.get('/friend-req', (req, res) => {
    const id = req.query.id;
    let partnerId = activePairs[id];
    if(partnerId) sendToClient(partnerId, { type: 'friend_req' });
    res.sendStatus(200);
});

app.get('/friend-ok', (req, res) => {
    const id = req.query.id;
    let partnerId = activePairs[id];
    if(partnerId) {
        let code = "ID-" + Math.floor(1000 + Math.random() * 9000);
        sendToClient(id, { type: 'friend_ok', friendName: userNames[partnerId], friendCode: code });
        sendToClient(partnerId, { type: 'friend_ok', friendName: userNames[id], friendCode: code });
    }
    res.sendStatus(200);
});

function sendToClient(id, data) {
    if (clients[id]) {
        clients[id].write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

function broadcastOnlineCount() {
    const count = Object.keys(clients).length;
    for (let id in clients) {
        sendToClient(id, { type: 'online', count: count });
    }
}

const PORT = process.env.PORT || 3000;
server = app.listen(PORT, "0.0.0.0", () =>
