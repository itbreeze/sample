import React, { useState } from "react";
import "./Panel.css";
import { Tabs } from "./Tabs";
import { FilterSelect } from "./FilterSelect";

export const Panel = ({ tabs = [], defaultTab, showFilterTabs = [] }) => {
  // tabs 배열이 없거나 비어있을 경우 null을 기본 탭으로 설정
  const initialTab = defaultTab || (tabs.length > 0 ? tabs[0].id : null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filter, setFilter] = useState("DrawingName");

  // 탭이 없으면 안내 메시지 출력
  if (!tabs || tabs.length === 0) {
    return <div className="panel empty">⚠️ 표시할 탭이 없습니다.</div>;
  }

  // 현재 활성 탭에 맞는 content 가져오기
  const activeContent =
    tabs.find((tab) => tab.id === activeTab)?.content(filter) || null;

  return (
    <div className="panel container">
      {/* 상단 탭 */}
      <div className="panel top">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="panel-tabs"
        />
      </div>

      {/* 중간 필터 (선택적 표시) */}
      {showFilterTabs.includes(activeTab) && (
        <div className="panel middle">
          <FilterSelect type="documents" filter={filter} onChange={setFilter} />
        </div>
      )}

      {/* 하단 컨텐츠 */}
      <div className="panel bottom">{activeContent}</div>
    </div>
  );
};
