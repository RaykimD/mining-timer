const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 클라이언트 상태 저장
const clients = new Set();
const timers = new Map();

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'client/build')));

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    clients.add(ws);
    
    // 현재 타이머 상태 전송
    const currentState = Array.from(timers.values());
    ws.send(JSON.stringify({
        type: 'init-timers',
        timers: currentState
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'start-timer':
                handleStartTimer(data);
                break;
            case 'reset-timer':
                handleResetTimer(data);
                break;
            case 'add-timer':
                handleAddTimer(data);
                break;
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
    });
});

function broadcast(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function handleStartTimer(data) {
    const timer = {
        id: data.id,
        minutes: data.minutes,
        timeLeft: data.minutes * 60,
        isRunning: true,
        endTime: new Date(Date.now() + data.minutes * 60 * 1000)
    };
    timers.set(data.id, timer);
    
    const interval = setInterval(() => {
        const timer = timers.get(data.id);
        if (timer && timer.timeLeft > 0) {
            timer.timeLeft -= 1;
            broadcast({
                type: 'timer-updated',
                timer
            });
        } else {
            clearInterval(interval);
        }
    }, 1000);

    broadcast({
        type: 'timer-updated',
        timer
    });
}

function handleResetTimer(data) {
    const timer = timers.get(data.id);
    if (timer) {
        timer.isRunning = false;
        timer.timeLeft = 0;
        timer.endTime = null;
        timers.set(data.id, timer);
        broadcast({
            type: 'timer-updated',
            timer
        });
    }
}

function handleAddTimer(data) {
    const timer = {
        id: data.timer.id,
        minutes: data.timer.minutes,
        timeLeft: 0,
        isRunning: false,
        endTime: null
    };
    timers.set(data.timer.id, timer);
    broadcast({
        type: 'timer-added',
        timer
    });
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
