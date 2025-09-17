import React from 'react';
import './Tooltip.css';

function Tooltip({ show, children, position = 'top' }) {
  if (!show) {
    return null;
  }

  const tooltipClasses = `tooltip-box ${position}`;

  return (
    <div className={tooltipClasses}>
      {children}
    </div>
  );
}

export default Tooltip;