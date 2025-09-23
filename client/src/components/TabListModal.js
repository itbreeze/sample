import React, { useEffect } from 'react';
import { X as CloseIcon } from 'lucide-react';
import './TabListModal.css';

const TabListModal = ({ isOpen, files, onClose, onSelectTab, onCloseTab }) => {
  // files 배열의 변경을 감지하여 목록이 비면 모달을 닫습니다.
  useEffect(() => {
    if (isOpen && files.length === 0) {
      onClose();
    }
  }, [files, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // 모달 외부 클릭 시 닫기
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>더 보기 목록</h2>
          <button className="modal-close-btn" onClick={onClose} title="닫기">
            <CloseIcon size={20} />
          </button>
        </div>
        <ul className="modal-list">
          {files.map((file) => (
            <li key={file.DOCNO} className="modal-list-item">
              <span 
                className="modal-item-name" 
                onClick={() => onSelectTab(file.DOCNO)} 
                title={file.DOCNM || file.DOCNUMBER}
              >
                {file.PLANTNM}/{file.UNIT}호기 [{file.DOCNUMBER}]{file.DOCNM}
              </span>
              <button
                className="modal-item-close-btn"
                onClick={() => onCloseTab(file.DOCNO)}
                title="탭 닫기"
              >
                <CloseIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TabListModal;