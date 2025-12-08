import React from "react";
import { TabList } from "./Tabs";

export const HeaderTabs = ({ tabs = [], activeTab, onChange }) => (
  <TabList tabs={tabs} activeTab={activeTab} onChange={onChange} className="header-tabs" />
);
