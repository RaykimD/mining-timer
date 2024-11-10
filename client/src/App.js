import React, { useState, useEffect } from 'react';

function App() {
  const [timers, setTimers] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // WebSocket 연결
    const websocket = new WebSocket(`ws://${window.location.host}`);
    
    websocket.onopen = () => {
      console.log('WebSocket Connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'init-timers':
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
          break;
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const startTimer = (id, minutes) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'start-timer',
        id,
        minutes
      }));
    }
  };

  const resetTimer = (id) => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'reset-timer',
        id
      }));
    }
  };

  const addNewRow = () => {
    if (ws) {
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
                    value={timer.minutes}
                    onChange={(e) => {
                      const newMinutes = parseInt(e.target.value);
                      if (newMinutes >= 0) {
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
                        timer.isRunning
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
