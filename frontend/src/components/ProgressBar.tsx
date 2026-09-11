import React from 'react';
import { formatElapsedSeconds, useElapsedTimer } from './Timer.js';

interface ProgressBarProps {
  progress: number;
  label?: string;
  timerStartTime?: number | null;
  completionTime?: number | null;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  timerStartTime,
  completionTime,
}) => {
  const clamped = Math.min(100, Math.max(0, progress));
  const showTimer = timerStartTime !== undefined || completionTime !== undefined;
  const elapsed = useElapsedTimer(timerStartTime ?? null, completionTime ?? null);
  const timeText = formatElapsedSeconds(elapsed);

  return (
    <div className="progress-bar">
      {label && <div className="progress-bar__label">{label}</div>}
      <div className="progress-bar__container">
        <div
          className="progress-bar__fill"
          style={{ width: `${clamped}%` }}
        />
        {showTimer && (
          <>
            <span className="progress-bar__timer progress-bar__timer--base">
              {timeText}
            </span>
            <div
              className="progress-bar__timer-clip"
              style={{ width: `${clamped}%` }}
            >
              <span className="progress-bar__timer progress-bar__timer--on-fill">
                {timeText}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
