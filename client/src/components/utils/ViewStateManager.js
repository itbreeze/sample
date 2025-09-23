// client/src/utils/ViewStateManager.js

class ViewStateManager {
  constructor() {
    this.viewStates = new Map();
    this.currentViewerInstance = null;
    this.currentDocno = null;
    this.autoSaveInterval = null;
    this.pendingSave = false;
  }

  // 뷰어 인스턴스 등록
  registerViewer(viewerInstance, docno) {
    // 이전 뷰 상태 저장
    if (this.currentViewerInstance && this.currentDocno) {
      this.saveCurrentViewState();
    }
    
    this.currentViewerInstance = viewerInstance;
    this.currentDocno = docno;
    
    // 자동 저장 시작
    this.startAutoSave();
  }

  // 현재 뷰 상태 추출
  getCurrentViewState(viewer = this.currentViewerInstance) {
    if (!viewer) return null;
    
    const view = viewer.activeView;
    if (!view) return null;

    try {
      if (view.position && view.target && view.upVector) {
        const viewParams = {
          position: view.position.toArray(),
          target: view.target.toArray(),
          upVector: view.upVector.toArray(),
          fieldWidth: view.fieldWidth,
          fieldHeight: view.fieldHeight,
          projection: view.projection,
          timestamp: Date.now()
        };
        view.delete();
        return viewParams;
      }
    } catch (error) {
      console.warn('뷰 상태 추출 실패:', error);
    }
    
    if (view.delete) view.delete();
    return null;
  }

  // 현재 활성 뷰 상태 저장
  saveCurrentViewState() {
    if (!this.currentViewerInstance || !this.currentDocno) return null;
    
    const viewState = this.getCurrentViewState();
    if (viewState) {
      this.viewStates.set(this.currentDocno, viewState);
      return viewState;
    }
    return null;
  }

  // 뷰 상태 복원
  restoreViewState(viewer, docno) {
    const savedState = this.viewStates.get(docno);
    if (!savedState || !viewer) return false;

    try {
      const view = viewer.activeView;
      if (view && savedState.position && savedState.target && savedState.upVector) {
        view.setView(
          savedState.position,
          savedState.target,
          savedState.upVector,
          savedState.fieldWidth,
          savedState.fieldHeight,
          savedState.projection
        );
        view.delete();
        viewer.update?.();
        return true;
      }
    } catch (error) {
      console.warn('뷰 상태 복원 실패:', error);
    }
    return false;
  }

  // 자동 저장 시작 (뷰포트 변경 감지)
  startAutoSave() {
    this.stopAutoSave();
    
    // 3초마다 뷰 상태 변경 감지 및 저장
    this.autoSaveInterval = setInterval(() => {
      if (this.currentViewerInstance && this.currentDocno && !this.pendingSave) {
        this.pendingSave = true;
        
        // 다음 프레임에서 저장 (렌더링 성능 고려)
        requestAnimationFrame(() => {
          this.saveCurrentViewState();
          this.pendingSave = false;
        });
      }
    }, 3000);
  }

  // 자동 저장 중지
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // 특정 도면의 뷰 상태 삭제
  removeViewState(docno) {
    this.viewStates.delete(docno);
  }

  // 모든 뷰 상태 삭제
  clearAllViewStates() {
    this.viewStates.clear();
  }

  // 뷰 상태 존재 여부 확인
  hasViewState(docno) {
    return this.viewStates.has(docno);
  }

  // 메모리 정리
  cleanup() {
    this.stopAutoSave();
    this.saveCurrentViewState(); // 마지막 상태 저장
    this.currentViewerInstance = null;
    this.currentDocno = null;
  }

  // 뷰 상태 통계 (디버깅용)
  getStats() {
    return {
      totalStates: this.viewStates.size,
      currentDoc: this.currentDocno,
      hasCurrentViewer: !!this.currentViewerInstance,
      isAutoSaving: !!this.autoSaveInterval
    };
  }
}

// 싱글톤 인스턴스
const viewStateManager = new ViewStateManager();

export default viewStateManager;