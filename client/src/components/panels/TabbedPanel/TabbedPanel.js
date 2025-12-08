import React, { useState, useEffect, useMemo } from "react";
import "./TabbedPanel.css";
import { FilterSelect } from "../../utils/FilterSelect";
import { ScrollTopControl } from "../../common/TreeControls";
import { TabList } from "../../common/Tabs";

export const TabbedPanel = (props) => {
  const {
    tabs = [],
    defaultTab,
    showFilterTabs = [],
    activeTab: controlledTab,
    onTabChange,
    onCollapseAll,
  } = props;

  void onCollapseAll;

  const isControlled = controlledTab != null;

  const initialTab = useMemo(
    () => defaultTab || (tabs.length > 0 ? tabs[0].id : null),
    [defaultTab, tabs]
  );
  const [uncontrolledTab, setUncontrolledTab] = useState(initialTab);

  useEffect(() => {
    if (!isControlled) {
      const validIds = tabs.map((tab) => tab.id);
      const next =
        defaultTab && validIds.includes(defaultTab) ? defaultTab : validIds[0];
      if (next && next !== uncontrolledTab) setUncontrolledTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab, tabs]);

  const currentTab = isControlled ? controlledTab : uncontrolledTab;

  const handleChange = (id) => {
    if (isControlled) {
      if (typeof onTabChange === "function") onTabChange(id);
    } else {
      setUncontrolledTab(id);
    }
  };

  const activeTabObj = useMemo(
    () => tabs.find((t) => t.id === currentTab) || tabs[0],
    [tabs, currentTab]
  );

  const [filter, setFilter] = useState("All");

  const activeContent = useMemo(() => {
    if (!activeTabObj) return null;
    if (typeof activeTabObj.content === "function") return activeTabObj.content(filter);
    return activeTabObj.content || null;
  }, [activeTabObj, filter]);

  return (
    <div className="tabbed-panel container">
      <div className="tabbed-panel top">
        <TabList
          tabs={tabs}
          activeTab={currentTab}
          onChange={handleChange}
          className="tabbed-panel-tabs"
        />
      </div>

      {activeTabObj && showFilterTabs.includes(activeTabObj.id) && (
        <div className="tabbed-panel middle">
          <FilterSelect
            type="documents"
            filter={filter}
            onChange={setFilter}
            variant="radio"
          />
        </div>
      )}

      <div className="tabbed-panel bottom">
        {tabs && tabs.length > 0 ? (
          activeContent
        ) : (
          <div className="tabbed-panel empty">No items to display.</div>
        )}

        {activeTabObj && showFilterTabs.includes(activeTabObj.id) && (
          <ScrollTopControl targetSelector=".tabbed-panel.bottom" />
        )}
      </div>
    </div>
  );
};
