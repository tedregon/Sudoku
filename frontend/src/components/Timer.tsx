import React, { useState, useEffect } from 'react';

interface TimerProps {
  timerStartTime: number | null;
  completionTime: number | null;
  label?: string;
}

export const Timer: React.FC<TimerProps> = ({ timerStartTime, completionTime, label }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (timerStartTime === null) {
      setElapsed(0);
      return;
    }

    const updateTimer = () => {
      const endTime = completionTime || Date.now();
      const elapsedMs = endTime - timerStartTime;
      setElapsed(Math.floor(elapsedMs / 1000));
    };

    updateTimer();
    
    // Only update if not completed (completionTime is null)
    if (completionTime === null) {
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [timerStartTime, completionTime]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer">
      {label && <div className="timer__label">{label}</div>}
      <div className="timer__display">{formatTime(elapsed)}</div>
    </div>
  );
};
