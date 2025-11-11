import React, { useState, useEffect, useMemo } from "react";
import "./Panel.css";
import { Tabs } from "./Tabs";
import { FilterSelect } from "./FilterSelect";
import { CollapseControl, ScrollTopControl } from "../common/TreeControls";

/**
 * Panel
 * - 컨트롤드: activeTab, onTabChange 전달 시 부모가 탭 상태 관리
 * - 언컨트롤드: defaultTab을 기반으로 내부 상태 관리
 */
export const Panel = ({
  tabs = [],                 // [{ id, label, content }]
  defaultTab,                // 언컨트롤드 초기 탭
  showFilterTabs = [],       // 상단 필터를 보여줄 탭 id 목록
  activeTab: controlledTab,  // 컨트롤드 현재 탭 (선택)
  onTabChange,               // 컨트롤드 변경 콜백 (선택)
}) => {
  const isControlled = controlledTab != null;

  // 언컨트롤드 상태
  const initialTab = useMemo(
    () => defaultTab || (tabs.length > 0 ? tabs[0].id : null),
    [defaultTab, tabs]
  );
  const [uncontrolledTab, setUncontrolledTab] = useState(initialTab);

  // defaultTab/tabs 변경에 따른 언컨트롤드 초기화
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

  // content가 함수면 filter 전달, 아니면 JSX 그대로
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

      {/* Filters (선택 표시) */}
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
            <CollapseControl wrapperClassName="tree-controls top" />
            <ScrollTopControl targetSelector=".panel.bottom" />
          </>
        )}
      </div>
    </div>
  );
};
