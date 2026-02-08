import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  return (
    <div className="progress-bar">
      {label && <div className="progress-bar__label">{label}</div>}
      <div className="progress-bar__container">
        <div
          className="progress-bar__fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="progress-bar__percentage">{progress}%</div>
    </div>
  );
};
