const express = require('express');
const path = require('path');
const fs = require('fs'); // 새로 추가
const app = express();
const http = require('http').createServer(app);
const WebSocket = require('ws');

const wss = new WebSocket.Server({ server: http });

app.use(express.static(path.join(__dirname, 'client/build')));

// 새로 추가되는 부분 시작
const TIMER_DATA_FILE = path.join(__dirname, 'timer-data.json');

// 타이머 데이터를 저장할 Map (let으로 변경)
let timerStorage = new Map();
const clients = new Set();
const timerIntervals = new Map();

// 파일에서 타이머 데이터 로드
function loadTimerData() {
    try {
        if (fs.existsSync(TIMER_DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(TIMER_DATA_FILE, 'utf8'));
            timerStorage = new Map(Object.entries(data));
            console.log('Timer data loaded from file');
        }
    } catch (error) {
        console.error('Error loading timer data:', error);
    }
}

// 타이머 데이터를 파일에 저장
function saveTimerData() {
    try {
        const data = Object.fromEntries(timerStorage);
        fs.writeFileSync(TIMER_DATA_FILE, JSON.stringify(data), 'utf8');
        console.log('Timer data saved to file');
    } catch (error) {
        console.error('Error saving timer data:', error);
    }
}

// 초기 데이터 로드
loadTimerData();

// 주기적으로 데이터 저장 (1분마다)
setInterval(saveTimerData, 60000);
// 새로 추가되는 부분 끝

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
                        spawnPoint: data.spawnPoint
                    };

                    timerStorage.set(data.id, timer);
                    saveTimerData(); // 새로 추가

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
                                saveTimerData(); // 새로 추가
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
                                saveTimerData(); // 새로 추가
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
                    if (timerIntervals.has(data.id)) {
                        clearInterval(timerIntervals.get(data.id));
                        timerIntervals.delete(data.id);
                    }

                    const timer = timerStorage.get(data.id);
                    if (timer) {
                        timer.isRunning = false;
                        timer.timeLeft = 0;
                        timer.endTime = null;
                        timer.spawnPoint = data.spawnPoint;
                        timerStorage.set(data.id, timer);
                        broadcast({
                            type: 'timer-updated',
                            timer: timer
                        });
                        saveTimerData(); // 새로 추가
                    }
                    break;
                }

                case 'add-timer': {
                    const timer = {
                        ...data.timer,
                        timeLeft: 0,
                        isRunning: false,
                        endTime: null,
                        spawnPoint: data.timer.spawnPoint || ''
                    };
                    timerStorage.set(timer.id, timer);
                    broadcast({
                        type: 'timer-added',
                        timer: timer
                    });
                    saveTimerData(); // 새로 추가
                    break;
                }

                case 'delete-timer': {
                    if (timerIntervals.has(data.id)) {
                        clearInterval(timerIntervals.get(data.id));
                        timerIntervals.delete(data.id);
                    }
                    
                    timerStorage.delete(data.id);
                    broadcast({
                        type: 'timer-deleted',
                        id: data.id
                    });
                    saveTimerData(); // 새로 추가
                    break;
                }

                case 'get-timers': {
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

// 새로 추가
process.on('SIGTERM', () => {
    console.log('Saving timer data before shutdown...');
    saveTimerData();
    process.exit(0);
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
