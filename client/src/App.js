import React, { useState, useEffect } from 'react';

function App() {
  const [timers, setTimers] = useState([]);
  const [ws, setWs] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('연결 중...');

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
      ws.send(JSON.stringify({
        type: 'start-timer',
        id,
        minutes
      }));
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('연결 오류 - 새로고침 필요');
    }
  };

  const resetTimer = (id) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'reset-timer',
        id
      }));
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('연결 오류 - 새로고침 필요');
    }
  };

  const addNewRow = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      const lastId = timers.length > 0 ? Math.max(...timers.map(t => t.id)) : 0;
      ws.send(JSON.stringify({
        type: 'add-timer',
        timer: {
          id: lastId + 1,
          minutes: '',
          timeLeft: 0,
          isRunning: false,
          endTime: null
        }
      }));
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('연결 오류 - 새로고침 필요');
    }
  };

  const getRowClassName = (timer) => {
    if (!timer.isRunning) return '';
    if (timer.timeLeft <= 60) return 'animate-pulse bg-red-300 font-bold';
    if (timer.timeLeft <= 180) return 'animate-pulse bg-yellow-300 font-bold';
    return '';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEndTime = (date) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">자생문 채광 타이머</h1>
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
              <th className="border p-2 w-24">채광 No.</th>
              <th className="border p-2 w-40">채굴 쿨타임</th>
              <th className="border p-2 w-40">타이머</th>
              <th className="border p-2 w-40">종료 시각</th>
              <th className="border p-2 w-32">동작</th>
            </tr>
          </thead>
          <tbody>
            {timers.map(timer => (
              <tr key={timer.id} className={getRowClassName(timer)}>
                <td className="border p-2 text-center">
                  <input
                    type="number"
                    className="w-full p-1 border rounded"
                    value={timer.id}
                    disabled
                  />
                </td>
                <td className="border p-2 text-center">
                  <input
                    type="number"
                    className="w-full p-1 border rounded"
                    value={timer.minutes || ''}
                    onChange={(e) => {
                      const newMinutes = parseInt(e.target.value);
                      if (!isNaN(newMinutes) && newMinutes >= 0) {
                        setTimers(prev => prev.map(t =>
                          t.id === timer.id ? { ...t, minutes: newMinutes } : t
                        ));
                      }
                    }}
                    disabled={timer.isRunning}
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
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
