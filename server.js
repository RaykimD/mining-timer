const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const wss = new WebSocket.Server({ server: http });

app.use(express.static(path.join(__dirname, 'client/build')));

// 타이머 데이터를 저장할 Map
const timerStorage = new Map();
const clients = new Set();
const timerIntervals = new Map();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');

    // 초기 타이머 데이터 전송
    const currentTimers = Array.from(timerStorage.values());
    ws.send(JSON.stringify({
        type: 'init-timers',
        timers: currentTimers
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'start-timer': {
                    // 기존 인터벌이 있다면 제거
                    if (timerIntervals.has(data.id)) {
                        clearInterval(timerIntervals.get(data.id));
                        timerIntervals.delete(data.id);
                    }

                    const timer = {
                        id: data.id,
                        minutes: data.minutes,
                        timeLeft: data.minutes * 60,
                        isRunning: true,
                        endTime: data.endTime,
                        spawnPoint: data.spawnPoint  // 추가
                    };

                    timerStorage.set(data.id, timer);

                    const interval = setInterval(() => {
                        const currentTimer = timerStorage.get(data.id);
                        if (currentTimer && currentTimer.isRunning && currentTimer.timeLeft > 0) {
                            currentTimer.timeLeft--;
                            timerStorage.set(data.id, currentTimer);
                            
                            broadcast({
                                type: 'timer-updated',
                                timer: currentTimer
                            });

                            if (currentTimer.timeLeft <= 0) {
                                clearInterval(interval);
                                timerIntervals.delete(data.id);
                                currentTimer.isRunning = false;
                                timerStorage.set(data.id, currentTimer);
                                broadcast({
                                    type: 'timer-updated',
                                    timer: currentTimer
                                });
                            }
                        } else {
                            clearInterval(interval);
                            timerIntervals.delete(data.id);
                            if (currentTimer) {
                                currentTimer.isRunning = false;
                                timerStorage.set(data.id, currentTimer);
                                broadcast({
                                    type: 'timer-updated',
                                    timer: currentTimer
                                });
                            }
                        }
                    }, 1000);

                    timerIntervals.set(data.id, interval);

                    broadcast({
                        type: 'timer-updated',
                        timer: timer
                    });
                    break;
                }

                case 'reset-timer': {
                    // 기존 인터벌이 있다면 제거
                    if (timerIntervals.has(data.id)) {
                        clearInterval(timerIntervals.get(data.id));
                        timerIntervals.delete(data.id);
                    }

                    const timer = timerStorage.get(data.id);
                    if (timer) {
                        timer.isRunning = false;
                        timer.timeLeft = 0;
                        timer.endTime = null;
                        timer.spawnPoint = data.spawnPoint;  // 추가
                        timerStorage.set(data.id, timer);
                        broadcast({
                            type: 'timer-updated',
                            timer: timer
                        });
                    }
                    break;
                }

                case 'add-timer': {
                    const timer = {
                        ...data.timer,
                        timeLeft: 0,
                        isRunning: false,
                        endTime: null,
                        spawnPoint: data.timer.spawnPoint || ''  // 추가
                    };
                    timerStorage.set(timer.id, timer);
                    broadcast({
                        type: 'timer-added',
                        timer: timer
                    });
                    break;
                }

                case 'delete-timer': {
                    // 인터벌 제거
                    if (timerIntervals.has(data.id)) {
                        clearInterval(timerIntervals.get(data.id));
                        timerIntervals.delete(data.id);
                    }
                    
                    timerStorage.delete(data.id);
                    broadcast({
                        type: 'timer-deleted',
                        id: data.id
                    });
                    break;
                }

                case 'get-timers': {
                    // 현재 실행 중인 타이머들의 상태를 확인하고 업데이트
                    const currentTimers = Array.from(timerStorage.values()).map(timer => {
                        if (timer.isRunning && timer.endTime) {
                            const endTime = new Date(timer.endTime);
                            const now = new Date();
                            const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));
                            timer.timeLeft = remainingTime;
                            if (remainingTime <= 0) {
                                timer.isRunning = false;
                                timer.endTime = null;
                            }
                        }
                        return timer;
                    });

                    ws.send(JSON.stringify({
                        type: 'init-timers',
                        timers: currentTimers
                    }));
                    break;
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

function broadcast(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
