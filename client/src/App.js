import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import logo from './images/logo.png';

function App() {
 const [timers, setTimers] = useState([]);
 const [ws, setWs] = useState(null);
 const [connectionStatus, setConnectionStatus] = useState('연결 중...');
 const [currentTime, setCurrentTime] = useState(new Date());

 useEffect(() => {
   const timer = setInterval(() => {
     setCurrentTime(new Date());
   }, 1000);
   return () => clearInterval(timer);
 }, []);

 useEffect(() => {
   let retryCount = 0;
   const maxRetries = 3;

   function connectWebSocket() {
     console.log('Attempting to connect WebSocket...');
     const websocket = new WebSocket(`wss://${window.location.host}`);
     
     websocket.onopen = () => {
       console.log('WebSocket Connected Successfully');
       setConnectionStatus('연결됨');
       retryCount = 0;
       websocket.send(JSON.stringify({ type: 'get-timers' }));
     };

     websocket.onerror = (error) => {
       console.error('WebSocket Error:', error);
       console.log('Connection attempt to:', window.location.host);
       setConnectionStatus('연결 오류');
     };

     websocket.onclose = () => {
       console.log('WebSocket Disconnected');
       setConnectionStatus('연결 끊김');
       
       if (retryCount < maxRetries) {
         retryCount++;
         console.log(`Retrying connection... Attempt ${retryCount}`);
         setTimeout(connectWebSocket, 3000);
       }
     };
websocket.onmessage = (event) => {
       console.log('Received message:', event.data);
       try {
         const data = JSON.parse(event.data);
         
         switch(data.type) {
           case 'init-timers':
             console.log('Initializing timers:', data.timers);
             setTimers(data.timers || []);
             break;
           case 'timer-updated':
             setTimers(prev => prev.map(timer => 
               timer.id === data.timer.id ? data.timer : timer
             ));
             break;
           case 'timer-added':
             setTimers(prev => [...prev, data.timer]);
             break;
           case 'timer-deleted':
             setTimers(prev => prev.filter(timer => timer.id !== data.id));
             break;
           default:
             console.log('Unknown message type:', data.type);
             break;
         }
       } catch (error) {
         console.error('Error processing message:', error);
       }
     };

     setWs(websocket);

     return websocket;
   }

   const websocket = connectWebSocket();

   return () => {
     websocket.close();
   };
 }, []);

const startTimer = (id, minutes) => {
   if (ws?.readyState === WebSocket.OPEN) {
     const endTime = new Date(currentTime.getTime() + minutes * 60000);
     const currentTimer = timers.find(t => t.id === id);
     ws.send(JSON.stringify({
       type: 'start-timer',
       id,
       minutes,
       endTime: endTime.toISOString(),
       spawnPoint: currentTimer?.spawnPoint || '',
       memo: currentTimer?.memo || ''  // 메모 추가
     }));
   } else {
     console.error('WebSocket is not connected');
     setConnectionStatus('연결 오류 - 새로고침 필요');
   }
};

const resetTimer = (id) => {
   if (ws?.readyState === WebSocket.OPEN) {
     const currentTimer = timers.find(t => t.id === id);
     ws.send(JSON.stringify({
       type: 'reset-timer',
       id,
       spawnPoint: currentTimer?.spawnPoint || '',
       memo: currentTimer?.memo || ''  // 메모 추가
     }));
   } else {
     console.error('WebSocket is not connected');
     setConnectionStatus('연결 오류 - 새로고침 필요');
   }
};

 const deleteTimer = (id) => {
   if (ws?.readyState === WebSocket.OPEN) {
     ws.send(JSON.stringify({
       type: 'delete-timer',
       id
     }));
     setTimers(prev => prev.filter(timer => timer.id !== id));
   } else {
     console.error('WebSocket is not connected');
     setConnectionStatus('연결 오류 - 새로고침 필요');
   }
 };
const addNewRow = () => {
   if (ws?.readyState === WebSocket.OPEN) {
     let newId = 1;
     const usedIds = new Set(timers.map(t => t.id));
     while (usedIds.has(newId)) {
       newId++;
     }

     ws.send(JSON.stringify({
       type: 'add-timer',
       timer: {
         id: newId,
         minutes: '',
         timeLeft: 0,
         isRunning: false,
         endTime: null,
         spawnPoint: '',
         memo: '' // 메모 필드 추가
       }
     }));
   } else {
     console.error('WebSocket is not connected');
     setConnectionStatus('연결 오류 - 새로고침 필요');
   }
 };

 const getRowClassName = (timer) => {
   if (!timer.isRunning) return '';
   if (timer.timeLeft <= 120) return 'animate-pulse bg-red-300 font-bold';  // 2분 (120초)
   if (timer.timeLeft <= 300) return 'animate-pulse bg-yellow-300 font-bold';  // 5분 (300초)
   return '';
};

 const formatTime = (seconds) => {
   const mins = Math.floor(seconds / 60);
   const secs = seconds % 60;
   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };

 const formatEndTime = (date) => {
   if (!date) return '--:--:--';
   return new Date(date).toLocaleTimeString('ko-KR', {
     hour: '2-digit',
     minute: '2-digit',
     second: '2-digit',
     hour12: false
   });
 };

const sortByRegenTime = () => {
   setTimers(prev => {
     return [...prev].sort((a, b) => {
       if (!a.endTime) return 1;
       if (!b.endTime) return -1;
       return new Date(a.endTime) - new Date(b.endTime);
     });
   });
 };

 const onDragEnd = (result) => {
   if (!result.destination) return;
   
   const items = Array.from(timers);
   const [reorderedItem] = items.splice(result.source.index, 1);
   items.splice(result.destination.index, 0, reorderedItem);
   
   setTimers(items);
 };

 return (
   <div className="container mx-auto p-4">
     <div className="flex items-center justify-between mb-6">
       <div className="w-1/3">
         <img src={logo} alt="닥트리오 로고" className="h-32 w-32 object-contain" />
       </div>
       <div className="w-1/3">
         <h1 className="text-4xl font-bold text-center">퍼켓몬 닥트리오 보스 타이머</h1>
       </div>
       <div className="w-1/3 text-right">
         <div className="text-2xl font-semibold">
           현재 시간: {currentTime.toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace('일 ', '일 ')}
        </div>
       </div>
     </div>
     <div className="text-center mb-2 text-sm">
       <span className={`px-2 py-1 rounded ${
         connectionStatus === '연결됨' ? 'bg-green-100' :
         connectionStatus === '연결 중...' ? 'bg-yellow-100' :
         'bg-red-100'
       }`}>
         {connectionStatus}
       </span>
     </div>
     <div className="overflow-x-auto">
       <table className="min-w-full bg-white border">
         <thead>
           <tr className="bg-gray-100">
             <th className="border p-2 w-20">보스 No.</th>
             <th className="border p-2 w-24">보스 쿨타임</th>
             <th className="border p-2 w-32">타이머</th>
             <th className="border p-2 w-40 cursor-pointer" onClick={sortByRegenTime}>
               보스 리셋 시간 ↑↓
             </th>
             <th className="border p-2 w-40">동작</th>
             <th className="border p-2 w-28">보스 스폰 채널</th>
             <th className="border p-2 w-40">메모</th> {/* 새로 추가된 메모 칸 */}
           </tr>
         </thead>
         <DragDropContext onDragEnd={onDragEnd}>
           <Droppable droppableId="timers">
             {(provided) => (
               <tbody {...provided.droppableProps} ref={provided.innerRef}>
                 {timers.map((timer, index) => (
                   <Draggable 
                     key={timer.id} 
                     draggableId={timer.id.toString()} 
                     index={index}
                   >
                     {(provided) => (
                       <tr
                         ref={provided.innerRef}
                         {...provided.draggableProps}
                         {...provided.dragHandleProps}
                         className={`${getRowClassName(timer)} hover:bg-gray-50`}
                       >
                         <td className="border p-2 text-center">
                           <select
                             className="w-full p-1 border rounded"
                             value={timer.id || ''}
                             onChange={(e) => {
                               const newId = parseInt(e.target.value);
                               setTimers(prev => prev.map(t => 
                                 t.id === timer.id ? { ...t, id: newId } : t
                               ));
                             }}
                           >
                             <option value="">선택</option>
                             {Array.from({length: 64}, (_, i) => i + 1).map(num => {
                               const isUsed = timers.some(t => t.id === num && t.id !== timer.id);
                               return (
                                 <option 
                                   key={num} 
                                   value={num}
                                   disabled={isUsed}
                                 >
                                   {num}
                                 </option>
                               );
                             })}
                           </select>
                         </td>
                         <td className="border p-2 text-center">
                           <input
                             type="number"
                             className="w-full p-1 border rounded"
                             value={timer.minutes || ''}
                             onChange={(e) => {
                               const value = e.target.value;
                               const newMinutes = parseInt(value);
                               if (value === '' || (!isNaN(newMinutes) && newMinutes >= 0 && newMinutes <= 1000)) {
                                 setTimers(prev => prev.map(t =>
                                   t.id === timer.id ? { ...t, minutes: value === '' ? '' : newMinutes } : t
                                 ));
                               }
                             }}
                             disabled={timer.isRunning}
                             min="0"
                             max="1000"
                           />
                         </td>
                         <td className="border p-2 text-center">
                           <div className="text-xl font-mono">
                             {timer.isRunning ? formatTime(timer.timeLeft) : '--:--'}
                           </div>
                         </td>
                         <td className="border p-2 text-center">
                           {formatEndTime(timer.endTime)}
                         </td>
                         <td className="border p-2 text-center">
                           <div className="flex justify-center space-x-2">
                             <button
                               className={`px-3 py-1 rounded ${
                                 timer.isRunning || !timer.minutes
                                   ? 'bg-gray-400 cursor-not-allowed'
                                   : 'bg-blue-500 hover:bg-blue-600 text-white'
                               }`}
                               onClick={() => startTimer(timer.id, timer.minutes)}
                               disabled={timer.isRunning || !timer.minutes}
                             >
                               시작
                             </button>
                             <button
                               className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white"
                               onClick={() => resetTimer(timer.id)}
                             >
                               리셋
                             </button>
                             <button
                               className="px-3 py-1 rounded bg-gray-500 hover:bg-gray-600 text-white"
                               onClick={() => deleteTimer(timer.id)}
                               disabled={timer.isRunning}
                             >
                               삭제
                             </button>
                           </div>
                         </td>
                         <td className="border p-2 text-center">
                           <select
                             className="w-full p-1 border rounded"
                             value={timer.spawnPoint || ''}
                             onChange={(e) => {
                               setTimers(prev => prev.map(t =>
                                 t.id === timer.id ? { ...t, spawnPoint: e.target.value } : t
                               ));
                             }}
                           >
                             <option value="">선택</option>
                             <option value="레드">레드</option>
                             <option value="블루">블루</option>
                             <option value="그린">그린</option>
                             <option value="옐로우">옐로우</option>
                             <option value="퍼플">퍼플</option>
                           </select>
                         </td>
                         <td className="border p-2 text-center">
                           <input
                             type="text"
                             className="w-full p-1 border rounded"
                             value={timer.memo || ''}
                             onChange={(e) => {
                               setTimers(prev => prev.map(t =>
                                 t.id === timer.id ? { ...t, memo: e.target.value } : t
                               ));
                             }}
                             placeholder="메모 입력..."
                           />
                         </td>
                       </tr>
                     )}
                   </Draggable>
                 ))}
                 {provided.placeholder}
               </tbody>
             )}
           </Droppable>
         </DragDropContext>
       </table>
     </div>
     <div className="mt-4 flex justify-center">
       <button
         onClick={addNewRow}
         className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
       >
         행 추가
       </button>
     </div>
   </div>
  );
}

export default App;
