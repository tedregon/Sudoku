import React, { useState, useEffect } from 'react';

interface TimerProps {
  timerStartTime: number | null;
  completionTime: number | null;
  label?: string;
}

export function formatElapsedSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function useElapsedTimer(
  timerStartTime: number | null,
  completionTime: number | null,
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timerStartTime === null) {
      setElapsed(0);
      return;
    }

    const updateTimer = () => {
      const endTime = completionTime || Date.now();
      setElapsed(Math.floor((endTime - timerStartTime) / 1000));
    };

    updateTimer();

    if (completionTime === null) {
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [timerStartTime, completionTime]);

  return elapsed;
}

export const Timer: React.FC<TimerProps> = ({ timerStartTime, completionTime, label }) => {
  const elapsed = useElapsedTimer(timerStartTime, completionTime);

  return (
    <div className="timer">
      {label && <div className="timer__label">{label}</div>}
      <div className="timer__display">{formatElapsedSeconds(elapsed)}</div>
    </div>
  );
};
