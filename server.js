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
                   const timer = timerStorage.get(data.id) || {
                       id: data.id,
                       minutes: data.minutes,
                       timeLeft: data.minutes * 60,
                       isRunning: true,
                       endTime: data.endTime
                   };

                   timer.isRunning = true;
                   timer.timeLeft = data.minutes * 60;
                   timer.endTime = data.endTime;
                   timerStorage.set(data.id, timer);

                   const interval = setInterval(() => {
                       const currentTimer = timerStorage.get(data.id);
                       if (currentTimer && currentTimer.isRunning && currentTimer.timeLeft > 0) {
                           currentTimer.timeLeft--;
                           timerStorage.set(data.id, currentTimer);
                           
                           // 모든 클라이언트에게 업데이트 전송
                           broadcast({
                               type: 'timer-updated',
                               timer: currentTimer
                           });
                       } else {
                           clearInterval(interval);
                           if (currentTimer) {
                               currentTimer.isRunning = false;
                               timerStorage.set(data.id, currentTimer);
                           }
                       }
                   }, 1000);

                   broadcast({
                       type: 'timer-updated',
                       timer: timer
                   });
                   break;
               }

               case 'reset-timer': {
                   const timer = timerStorage.get(data.id);
                   if (timer) {
                       timer.isRunning = false;
                       timer.timeLeft = 0;
                       timer.endTime = null;
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
                       endTime: null
                   };
                   timerStorage.set(timer.id, timer);
                   broadcast({
                       type: 'timer-added',
                       timer: timer
                   });
                   break;
               }

               case 'delete-timer': {
                   timerStorage.delete(data.id);
                   broadcast({
                       type: 'timer-deleted',
                       id: data.id
                   });
                   break;
               }

               case 'get-timers': {
                   const currentTimers = Array.from(timerStorage.values());
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
