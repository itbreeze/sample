import React from "react";
import "./FilterSelect.css";

export const FilterSelect = ({ type = "documents", filter, onChange }) => {
  const t = type?.toLowerCase();

  let options = [];
  if (t === "documents") {
    options = [
      { value: "All", label: "전체" },
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
