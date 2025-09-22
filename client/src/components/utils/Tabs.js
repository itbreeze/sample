import React from "react";
import "./Tabs.css";

export const Tabs = ({ tabs = [], activeTab, onChange, className = '' }) => {
    return (
        <div className={`tab-component ${className}`}>
            <div className="tab-list">
                {tabs.map(tab => (                    
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