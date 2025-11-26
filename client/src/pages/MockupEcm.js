import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import './MockupEcm.css';
import { checkUser, getAuthConfig } from '../auth/AuthModule';

function MockUpECM() {
  const [userId, setUserId] = useState('psn21115');
  const [resultMessage, setResultMessage] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [plantScopeFilter, setPlantScopeFilter] = useState(false);

  useEffect(() => {
    getAuthConfig().then((config) => {
      if (typeof config.usePlantScopeFilter === 'boolean') {
        setPlantScopeFilter(config.usePlantScopeFilter);
      }
    });
  }, []);

  const composeSuccessMessage = (data, inputId) => {
    const u = data.user || {};
    const id = u.userId || inputId;
    const name = u.name || '';
    const dept = u.deptName || '';
    const plant = u.plantCode || '';
    const authName = (u.authName || '').trim() || '권한 없음';
    const authId = u.sAuthId || '';
    const authLabel = authId ? `${authName} (${authId})` : authName;

    const text = [
      '✅ 사용자 검증 완료',
      '',
      `아이디: ${id}`,
      name ? `이름: ${name}` : '',
      dept ? `부서: ${dept}` : '',
      `권한: ${authLabel}`,
      plant ? `플랜트: ${plant}(플랜트코드)` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return <p className="mockup-ecm-output-text">{text}</p>;
  };

  const handleRun = async () => {
    const trimmed = userId.trim();

    if (!trimmed) {
      setResultMessage(<p className="mockup-ecm-output-text">사용자를 입력해주세요.</p>);
      return;
    }

    console.log('[MockupECM] 검증 요청', { userId: trimmed });
    setIsRunning(true);
    setResultMessage(<p className="mockup-ecm-output-text">사용자 정보를 확인 중...</p>);

    const data = await checkUser(trimmed);
    console.log('[MockupECM] 검증 응답', {
      userId: trimmed,
      ok: data?.ok,
      allowed: data?.allowed,
      stage: data?.stage,
      plantScopeFilter: data?.usePlantScopeFilter,
      user: data?.user,
    });

    setPlantScopeFilter(
      typeof data.usePlantScopeFilter === 'boolean' ? data.usePlantScopeFilter : false
    );

    if (!data.ok || !data.allowed) {
      console.warn('[MockupECM] 검증 실패', {
        userId: trimmed,
        stage: data.stage,
        ok: data.ok,
        allowed: data.allowed,
      });
      if (data.stage === 'EXPIRED') {
        setResultMessage(<p className="mockup-ecm-output-text">권한이 만료되었습니다.</p>);
      } else {
        setResultMessage(<p className="mockup-ecm-output-text">권한이 없습니다.</p>);
      }
      setIsRunning(false);
      return;
    }

    setResultMessage(composeSuccessMessage(data, trimmed));
    setIsRunning(false);

    const u = data.user || {};
    const payload = {
      userId: u.userId || trimmed,
      name: u.name || '',
      deptName: u.deptName || '',
      deptCode: u.deptCode || '',
      plantCode: u.plantCode || '',
      authName: u.authName || '',
      sAuthId: u.sAuthId || '',
      endDate: u.endDate || '',
      plantScopeFilter:
        typeof data.usePlantScopeFilter === 'boolean' ? data.usePlantScopeFilter : undefined,
    };
    console.log('[MockupECM] 검증 성공', payload);

    const newWin = window.open('/ePnidSystem', '_blank');
    if (newWin) {
      newWin.name = JSON.stringify(payload);
      console.log('ECM 인증 payload:', payload);
      console.log('ECM 응답 데이터:', data);
    } else {
      console.warn('새 창을 열 수 없습니다. 팝업 차단을 확인하세요.');
    }
  };

  return (
    <div className="mockup-ecm-root">
      <div className="mockup-ecm-wrapper">
        <div className="mockup-ecm-card">
          <header className="mockup-ecm-header">
            <h1 className="mockup-ecm-title">Mockup-ECM</h1>
            <p className="mockup-ecm-output-sub">
              사업소 필터: {plantScopeFilter ? 'ON (사업소 목록 제한)' : 'OFF (전체 목록 조회)'}
            </p>
          </header>

          <div className="mockup-ecm-input-row">
            <label className="mockup-ecm-label">
              사용자
              <input
                type="text"
                className="mockup-ecm-input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRun()}
              />
            </label>

            <button
              type="button"
              className="mockup-ecm-run-btn"
              onClick={handleRun}
              disabled={isRunning}
            >
              <Play size={18} />
              <span>{isRunning ? '확인 중...' : '검증'}</span>
            </button>
          </div>
        </div>

        <div className={`mockup-ecm-output ${resultMessage ? 'show' : ''}`}>
          {resultMessage}
        </div>
      </div>
    </div>
  );
}

export default MockUpECM;
