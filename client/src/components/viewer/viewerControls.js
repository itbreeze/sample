// client/src/components/viewer/viewerControls.js

/**
 * 마우스 휠 스크롤을 이용한 줌 기능을 캔버스에 추가합니다.
 * @param {object} viewer - Visualize.js 뷰어 인스턴스
 * @param {HTMLElement} canvas - 캔버스 DOM 요소
 * @param {number} zoomFactor - 줌 배율
 * @returns {function} - 이벤트 리스너를 제거하는 cleanup 함수
 */
export const attachWheelZoom = (viewer, canvas, zoomFactor = 1.1) => {
    if (!viewer || !canvas) return () => {};
    const onWheel = (event) => {
        event.preventDefault();
        viewer.zoomAt?.(event.deltaY > 0 ? 1 / zoomFactor : zoomFactor, event.offsetX, event.offsetY);
        viewer.update?.();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
};

/**
 * 마우스 중간 버튼 드래그를 이용한 이동(Pan) 기능을 캔버스에 추가합니다.
 * 💡 중간 버튼 더블클릭 시 Zoom Extents 기능 포함
 * @param {object} viewer - Visualize.js 뷰어 인스턴스
 * @param {HTMLElement} canvas - 캔버스 DOM 요소
 * @returns {function} - 이벤트 리스너를 제거하는 cleanup 함수
 */
export const attachPan = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};

    let isPanning = false;
    let lastMouseX = 0, lastMouseY = 0;
    const defaultCursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect width=\"16\" height=\"16\" fill=\"none\" stroke=\"black\" stroke-width=\"2\"/></svg>') 8 8, auto";
    canvas.style.cursor = defaultCursor;

    // 💡 더블클릭 감지를 위한 변수
    let lastMiddleClickTime = 0;
    let clickTimer = null;
    const doubleClickThreshold = 400; // 더블클릭으로 인정할 시간 간격 (밀리초)
    const dragThreshold = 5; // 드래그로 인정할 최소 이동 거리 (픽셀)
    let mouseDownX = 0;
    let mouseDownY = 0;
    let hasMoved = false;

    const onMouseDown = (event) => {
        // 💡 마우스 가운데 버튼(휠 클릭)일 때만 동작
        if (event.button === 1) {
            event.preventDefault();

            const now = new Date().getTime();
            mouseDownX = event.clientX;
            mouseDownY = event.clientY;
            hasMoved = false;

            // 💡 이전 클릭 타이머가 있으면 취소
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            // 💡 더블클릭 여부 판단
            if (now - lastMiddleClickTime < doubleClickThreshold) {
                // 더블클릭으로 판정 -> Zoom Extents 실행
                console.log('[Pan Control] 휠 더블클릭 감지 - Zoom Extents 실행');
                
                try {
                    viewer.zoomExtents?.();
                    viewer.update?.();
                } catch (error) {
                    console.error('[Pan Control] Zoom Extents 오류:', error);
                }
                
                // 타이머 리셋
                lastMiddleClickTime = 0;
                isPanning = false;
                canvas.style.cursor = defaultCursor;
            } else {
                // 첫 번째 클릭 - Pan 준비
                lastMiddleClickTime = now;
                
                // 💡 일정 시간 후에도 더블클릭이 안 오면 Pan 시작
                clickTimer = setTimeout(() => {
                    if (!hasMoved) {
                        isPanning = true;
                        lastMouseX = mouseDownX;
                        lastMouseY = mouseDownY;
                        canvas.style.cursor = 'grab';
                    }
                    clickTimer = null;
                }, doubleClickThreshold);
            }
        }
    };

    const onMouseMove = (event) => {
        if (event.button === 1 || isPanning) {
            const deltaX = Math.abs(event.clientX - mouseDownX);
            const deltaY = Math.abs(event.clientY - mouseDownY);
            
            // 💡 일정 거리 이상 움직이면 드래그로 간주
            if (!hasMoved && (deltaX > dragThreshold || deltaY > dragThreshold)) {
                hasMoved = true;
                
                // 💡 드래그가 시작되면 더블클릭 타이머 취소
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                
                isPanning = true;
                lastMouseX = mouseDownX;
                lastMouseY = mouseDownY;
                canvas.style.cursor = 'grab';
            }
        }

        if (!isPanning) return;
        
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        viewer.pan?.(deltaX, deltaY);
        viewer.update?.();
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    };

    const onMouseUpOrLeave = (event) => {
        // 💡 Pan 동작이 끝났을 때만 isPanning을 false로 설정
        if (isPanning && event.button === 1) {
            isPanning = false;
            canvas.style.cursor = defaultCursor;
            hasMoved = false;
        }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUpOrLeave);
    canvas.addEventListener('mouseleave', onMouseUpOrLeave);
    window.addEventListener('mouseup', onMouseUpOrLeave);

    return () => {
        if (canvas) {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUpOrLeave);
            canvas.removeEventListener('mouseleave', onMouseUpOrLeave);
        }
        window.removeEventListener('mouseup', onMouseUpOrLeave);
        
        // 💡 cleanup 시 타이머도 정리
        if (clickTimer) {
            clearTimeout(clickTimer);
        }
    };
};

function makeDxfList(entityId) {
    if (!entityId) return null;
    let obj = null;
    let objName = "Unknown";
    const type = entityId.getType();
    switch (type) {
        case 1: objName = 'ENTITY'; obj = entityId.openObject(); break;
        case 2: objName = 'INSERT'; obj = entityId.openObjectAsInsert(); break;
        default: break;
    }
    if (!obj) return { object: objName, handle: null };
    return {
        object: objName,
        layer: obj.getLayer().openObject().getName(),
        handle: obj.getNativeDatabaseHandle()
    };
}

/**
 * 캔버스 클릭 시 해당 위치의 객체 정보를 콘솔에 출력하는 기능을 추가합니다.
 * @param {object} viewer - Visualize.js 뷰어 인스턴스
 * @param {HTMLElement} canvas - 캔버스 DOM 요소
 * @returns {function} - 이벤트 리스너를 제거하는 cleanup 함수
 */
export const attachClickInfo = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};
    const onClick = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x1 = event.clientX - rect.left;
        const y1 = event.clientY - rect.top;
        try {
            viewer.unselect?.();
            viewer.select?.(x1, y1, x1 + 0.2, y1 + 0.2);
            viewer.update?.();
            const pSelected = viewer.getSelected?.();
            if (pSelected && !pSelected.isNull() && pSelected.numItems() !== 0) {
                const itr = pSelected.getIterator();
                while (itr && !itr.done()) {
                    const entityId = itr.getEntity();
                    if (entityId && !entityId.isNull?.()) {
                        console.log(makeDxfList(entityId));
                    }
                    itr.step();
                }
            } else {
                console.log("선택된 객체 없음");
            }
        } catch (err) {
            console.error("attachClickInfo 오류:", err);
        }
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
};