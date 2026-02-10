import { useEffect } from 'react';
import { socketService } from '../services/socketService.js';

export function useSocket() {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSocket.ts:5',message:'useSocket: connecting socket',data:{timestamp:Date.now()},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    socketService.connect();

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c96d2929-a514-4266-ae0e-7555c7469794',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSocket.ts:10',message:'useSocket: disconnecting socket on cleanup',data:{timestamp:Date.now()},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      socketService.disconnect();
    };
  }, []);

  return socketService;
}
