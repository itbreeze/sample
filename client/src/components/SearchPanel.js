import React from "react";
import { Panel } from "./utils/Panel";
import DrawingDocuments from "./DrawingDocuments";

// 샘플 컴포넌트
const DrawingSearch = ({ filter }) => (
  <div>🔍 도면 검색 (필터: {filter})</div>
);
const EquipmentSearch = () => <div>⚙️ 설비 검색 (샘플 화면)</div>;

const searchTabs = [
  {
    id: "documentList",
    label: "도면목록",
    content: (filter) => <DrawingDocuments filter={filter} />,
  },
  {
    id: "searchDrawing",
    label: "도면검색",
    content: (filter) => <DrawingSearch filter={filter} />,
  },
  {
    id: "searchEquipment",
    label: "설비검색",
    content: () => <EquipmentSearch />,
  },
];

export const SearchPanel = () => (
  <Panel
    tabs={searchTabs}
    defaultTab="searchDrawing"
    showFilterTabs={["documentList", "searchDrawing"]}
  />
);
