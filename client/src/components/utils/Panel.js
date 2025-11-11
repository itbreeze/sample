import React, { useState, useEffect, useMemo } from "react";
import "./Panel.css";
import { Tabs } from "./Tabs";
import { FilterSelect } from "./FilterSelect";
import { CollapseControl, ScrollTopControl } from "../common/TreeControls";

/**
 * Panel
 * - Controlled: activeTab, onTabChange are managed by parent when provided
 * - Uncontrolled: defaultTab is used for internal state when not controlled
 */
export const Panel = (props) => {
  const {
    tabs = [],                 // [{ id, label, content }]
    defaultTab,                // initial tab when uncontrolled
    showFilterTabs = [],       // tab ids that show the filter bar
    activeTab: controlledTab,  // controlled current tab id (optional)
    onTabChange,               // controlled change callback (optional)
    onCollapseAll,             // collapse-all callback (optional)
  } = props;

  const isControlled = controlledTab != null;

  // Uncontrolled state
  const initialTab = useMemo(
    () => defaultTab || (tabs.length > 0 ? tabs[0].id : null),
    [defaultTab, tabs]
  );
  const [uncontrolledTab, setUncontrolledTab] = useState(initialTab);

  // Reset uncontrolled initial when defaultTab/tabs change
  useEffect(() => {
    if (!isControlled) {
      const validIds = tabs.map(t => t.id);
      const next = defaultTab && validIds.includes(defaultTab) ? defaultTab : validIds[0];
      if (next && next !== uncontrolledTab) setUncontrolledTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab, tabs]);

  const current = isControlled ? controlledTab : uncontrolledTab;

  const handleChange = (id) => {
    if (isControlled) {
      if (typeof onTabChange === "function") onTabChange(id);
    } else {
      setUncontrolledTab(id);
    }
  };

  const activeTabObj = useMemo(
    () => tabs.find(t => t.id === current) || tabs[0],
    [tabs, current]
  );

  // content can be a function expecting filter, otherwise JSX
  const [filter, setFilter] = useState("DrawingName");
  const activeContent = useMemo(() => {
    if (!activeTabObj) return null;
    if (typeof activeTabObj.content === "function") return activeTabObj.content(filter);
    return activeTabObj.content || null;
  }, [activeTabObj, filter]);

  return (
    <div className="panel container">
      {/* Tabs */}
      <div className="panel top">
        <Tabs
          tabs={tabs}
          activeTab={current}
          onChange={handleChange}
          className="panel-tabs"
        />
      </div>

      {/* Filters (optional) */}
      {activeTabObj && showFilterTabs.includes(activeTabObj.id) && (
        <div className="panel middle">
          <FilterSelect type="documents" filter={filter} onChange={setFilter} />
        </div>
      )}

      {/* Content */}
      <div className="panel bottom">
        {tabs && tabs.length > 0 ? (
          activeContent
        ) : (
          <div className="panel empty">No items to display.</div>
        )}

        {/* Tree controls: Collapse(top-right) + ScrollTop(bottom-right) */}
        {activeTabObj && showFilterTabs.includes(activeTabObj.id) && (
          <>
            <CollapseControl wrapperClassName="tree-controls top" onCollapseAll={onCollapseAll} />
            <ScrollTopControl targetSelector=".panel.bottom" />
          </>
        )}
      </div>
    </div>
  );
};

