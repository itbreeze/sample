import React from "react";
import "./Tabs.css";

export const Tabs = ({ tabs = [], activeTab, onChange, className = '' }) => {
    return (
        <div className={`tab-component ${className}`}>
            <div className="tab-list">
                {tabs.map(tab => (
                    // [핵심] 반복되는 가장 바깥 요소에 고유한 key를 추가합니다.
                    <div
                        key={tab.id}
                        className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => onChange(tab.id)}
                    >
                        {tab.label}
                    </div>
                ))}
            </div>
        </div>
    );
};