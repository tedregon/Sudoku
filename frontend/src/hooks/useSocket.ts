import { useEffect } from 'react';
import { socketService } from '../services/socketService.js';

export function useSocket() {
  useEffect(() => {
    socketService.connect();

    return () => {
      socketService.disconnect();
    };
  }, []);

  return socketService;
}
