import React from "react";
import "./Tabs.css";

export const Tabs = ({ tabs = [], activeTab, onChange, className = '' }) => {
    return (
        <div className={`tab-component ${className}`}>
            <div className="tab-list">
                {tabs.map(tab => {
                    const autoShort = tab.shortLabel ?? (
                        tab?.id === 'documentList' ? '도면목록' :
                        tab?.id === 'searchDrawing' ? '도면검색' :
                        tab?.id === 'searchEquipment' ? '설비검색' :
                        null
                    );
                    return (
                        <div
                            key={tab.id}
                            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => onChange(tab.id)}
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
