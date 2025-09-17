import React from 'react';
import CanvasViewer from './CanvasViewer'; // ◀◀ import 이름 변경
import './MainView.css';

const MainView = (props) => {
  if (!props.openFiles || props.openFiles.length === 0) {
    return (
      <main className="app-main-view">
        <div className="initial-view-content">
          <h2>Intelligent Tool</h2>
          <p>좌측 메뉴에서 도면을 선택하여 열어주세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main-view">
      <CanvasViewer {...props} /> {/* ◀◀ 사용된 컴포넌트 이름 변경 */}
    </main>
  );
};

export default MainView;