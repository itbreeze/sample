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
 * 마우스 좌클릭 드래그와 휠 클릭을 이용한 이동(Pan) 기능을 캔버스에 추가합니다.
 * - 좌클릭 + 드래그: 패닝
 * - 휠 클릭 + 드래그: 패닝
 * - 휠 더블클릭: Zoom Extents
 * @param {object} viewer - Visualize.js 뷰어 인스턴스
 * @param {HTMLElement} canvas - 캔버스 DOM 요소
 * @returns {function} - 이벤트 리스너를 제거하는 cleanup 함수
 */
export const attachPan = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};

    let isPanning = false;
    let panButton = null; // 어떤 버튼으로 패닝 중인지 추적
    let lastMouseX = 0, lastMouseY = 0;
    const defaultCursor = "default";
    canvas.style.cursor = defaultCursor;

    // 휠 더블클릭 감지
    let lastMiddleClickTime = 0;
    let clickCount = 0;
    const doubleClickThreshold = 400;

    const onMouseDown = (event) => {
        // 좌클릭(버튼 0)으로 패닝
        if (event.button === 0) {
            isPanning = true;
            panButton = 0;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
        }
        
        // 휠 클릭(버튼 1)으로 패닝 또는 더블클릭
        if (event.button === 1) {
            event.preventDefault();
            const now = new Date().getTime();

            // 더블클릭 감지
            if (now - lastMiddleClickTime < doubleClickThreshold) {
                clickCount++;
                
                if (clickCount === 2) {
                    console.log('[Pan Control] 휠 더블클릭 - Zoom Extents');
                    
                    try {
                        viewer.zoomExtents?.();
                        viewer.update?.();
                    } catch (error) {
                        console.error('[Pan Control] Zoom Extents 오류:', error);
                    }
                    
                    // 리셋
                    lastMiddleClickTime = 0;
                    clickCount = 0;
                    isPanning = false;
                    panButton = null;
                    canvas.style.cursor = defaultCursor;
                    return;
                }
            } else {
                clickCount = 1;
            }
            
            lastMiddleClickTime = now;
            
            // 패닝 시작 (더블클릭이 아닌 경우)
            isPanning = true;
            panButton = 1;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
        }
    };

    const onMouseMove = (event) => {
        if (!isPanning) return;
        
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        viewer.pan?.(deltaX, deltaY);
        viewer.update?.();
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    };

    const onMouseUp = (event) => {
        // 패닝 중인 버튼이 떼어진 경우에만 패닝 종료
        if (isPanning && event.button === panButton) {
            isPanning = false;
            panButton = null;
            canvas.style.cursor = defaultCursor;
        }
    };

    const onMouseLeave = () => {
        // 캔버스를 벗어나면 무조건 패닝 종료
        if (isPanning) {
            isPanning = false;
            panButton = null;
            canvas.style.cursor = defaultCursor;
        }
    };

    const onContextMenu = (event) => {
        // 우클릭 컨텍스트 메뉴 비활성화
        event.preventDefault();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    
    // window의 mouseup은 캔버스 밖에서 버튼을 뗐을 때를 위해
    window.addEventListener('mouseup', onMouseUp);

    return () => {
        if (canvas) {
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('contextmenu', onContextMenu);
        }
        window.removeEventListener('mouseup', onMouseUp);
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
 * 💡 패닝 중에는 객체 선택이 발생하지 않도록 처리
 * @param {object} viewer - Visualize.js 뷰어 인스턴스
 * @param {HTMLElement} canvas - 캔버스 DOM 요소
 * @returns {function} - 이벤트 리스너를 제거하는 cleanup 함수
 */
export const attachClickInfo = (viewer, canvas) => {
    if (!viewer || !canvas) return () => {};
    
    let mouseDownX = 0;
    let mouseDownY = 0;
    let mouseDownTime = 0;
    let hasMoved = false;
    const moveThreshold = 5; // 5px 이상 움직이면 드래그로 간주
    const clickTimeThreshold = 300; // 300ms 이상 누르고 있으면 드래그로 간주
    
    const onMouseDown = (event) => {
        if (event.button === 0) {
            mouseDownX = event.clientX;
            mouseDownY = event.clientY;
            mouseDownTime = Date.now();
            hasMoved = false;
        }
    };
    
    const onMouseMove = (event) => {
        const deltaX = Math.abs(event.clientX - mouseDownX);
        const deltaY = Math.abs(event.clientY - mouseDownY);
        
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            hasMoved = true;
        }
    };
    
    const onClick = (event) => {
        const clickDuration = Date.now() - mouseDownTime;
        
        // 드래그했거나 오래 누르고 있었으면 객체 선택 안 함
        if (hasMoved || clickDuration > clickTimeThreshold) {
            hasMoved = false;
            return;
        }
        
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
    
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    
    return () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("click", onClick);
    };
};