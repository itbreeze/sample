import React from "react";
import "./FilterSelect.css";

export const FilterSelect = ({ type = "documents", filter, onChange, variant = "select" }) => {
  const t = type?.toLowerCase();

  let options = [];
  if (t === "documents") {
    options = [
      { value: "All", label: "[도면명] 도면번호" },
      { value: "DrawingName", label: "도면명" },
      { value: "DrawingNumber", label: "도면번호" },
    ];
  } else if (t === "short") {
    options = [
      { value: "All", label: "전체" },
      { value: "DrawingName", label: "명" },
      { value: "DrawingNumber", label: "번호" },
    ];
  }

  if (variant === "radio") {
    const groupName = `filter-${t || 'group'}`;
    const getShortLabel = (value, fallback) => {
      switch (value) {
        case 'All':
          return '전체';
        case 'DrawingName':
          return '도면명';
        case 'DrawingNumber':
          return '도면번호';
        default:
          return fallback ?? '';
      }
    };

    return (
      <div className="combo-container radio-variant" role="radiogroup" aria-label="Filter">
        {options.map(opt => (
          <label className="radio-option" key={opt.value}>
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={filter === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <span className="label-full">{opt.label}</span>
              <span className="label-short">{getShortLabel(opt.value, opt.label)}</span>
            </span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="combo-container">
      <select
        className="filter-select"
        value={filter}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
