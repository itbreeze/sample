import React, { useMemo } from "react";
import "./Tabs.css";

export const TabList = ({ tabs = [], activeTab, onChange, className = "" }) => {
  const isSelectable = useMemo(
    () => tabs.length > 1 && typeof onChange === "function",
    [tabs, onChange]
  );

  const handleChange = (tabId) => {
    if (isSelectable) {
      onChange(tabId);
    }
  };

  return (
    <div
      className={`tab-component ${className} ${isSelectable ? "multi-tab" : "single-tab"}`}
    >
      <div className="tab-list">
        {tabs.map((tab) => {
          const autoShort =
            tab.shortLabel ??
            (tab?.id === "documentList"
              ? "도면목록"
              : tab?.id === "searchDrawing"
              ? "도면검색"
              : tab?.id === "searchEquipment"
              ? "설비검색"
              : null);

          const tabClasses = [
            "tab-item",
            activeTab === tab.id ? "active" : "",
            isSelectable ? "selectable" : "disabled",
          ]
            .join(" ")
            .trim();

          return (
            <div
              key={tab.id}
              className={tabClasses}
              onClick={() => handleChange(tab.id)}
              aria-disabled={!isSelectable}
              role="button"
              tabIndex={isSelectable ? 0 : -1}
            >
              {autoShort ? (
                <>
                  <span className="label-full">{tab.label}</span>
                  <span className="label-short">{autoShort}</span>
                </>
              ) : (
                tab.label
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
