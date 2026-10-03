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

  const isComplete = completionTime != null;

  return (
    <div className="progress-bar">
      {label && <div className="progress-bar__label">{label}</div>}
      <div className="progress-bar__container">
        <div
          className={`progress-bar__fill${isComplete ? ' progress-bar__fill--complete' : ''}`}
          style={{ height: `${clamped}%` }}
        />
        {showTimer && (
          <div className="progress-bar__row">
            {isComplete && (
              <span className="progress-bar__check" title="Finished" aria-label="Finished">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
            <span className="progress-bar__time">{timeText}</span>
          </div>
        )}
      </div>
    </div>
  );
};
