import React, { useState } from "react";
import "./Panel.css";
import { Tabs } from "./Tabs";
import { FilterSelect } from "./FilterSelect";

export const Panel = ({ tabs = [], defaultTab, showFilterTabs = [] }) => {
  const initialTab = defaultTab || (tabs.length > 0 ? tabs[0].id : null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filter, setFilter] = useState("DrawingName");
  const [showScrollTop] = useState(false);

  // Determine active content (null-safe when tabs are empty)
  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content(filter) || null;

  // Scroll-to-top feature removed per request

  return (
    <div className="panel container">
      {/* Top */}
      <div className="panel top">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="panel-tabs"
        />
      </div>

      {/* Middle (filters) */}
      {showFilterTabs.includes(activeTab) && (
        <div className="panel middle">
          <FilterSelect type="documents" filter={filter} onChange={setFilter} />
        </div>
      )}

      {/* Bottom content */}
      <div className="panel bottom">
        {tabs && tabs.length > 0 ? (
          activeContent
        ) : (
          <div className="panel empty">No items to display.</div>
        )}
      </div>
    </div>
  );
};
