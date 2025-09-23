// hooks/useDrawingLoader.js

import { useState, useEffect, useCallback, useRef } from 'react';
import drawingLoaderService from '../services/DrawingLoaderService';

export const useDrawingLoader = () => {
  // ─── 상태 관리 ─────────────────────────────
  const [loadingStates, setLoadingStates] = useState(new Map()); // 도면별 로딩 상태
  const [errors, setErrors] = useState(new Map());               // 도면별 에러 상태
  const [stats, setStats] = useState({ cacheSize: 0, loadingCount: 0 }); // 로딩 통계
  const listenerRef = useRef(null);

  // ─── 서비스 이벤트 리스너 등록 ─────────────
  useEffect(() => {
    const handleServiceEvent = (event, data) => {
      const key = `${data.docno}_${data.docvr}`;
      
      switch (event) {
        case 'cache_hit':
        case 'loaded':
          setLoadingStates(prev => new Map(prev.set(key, false)));
          setErrors(prev => new Map(prev.set(key, null)));
          break;
        case 'error':
          setLoadingStates(prev => new Map(prev.set(key, false)));
          setErrors(prev => new Map(prev.set(key, data.error)));
          break;
      }

      setStats(drawingLoaderService.getStats());
    };

    listenerRef.current = drawingLoaderService.addListener(handleServiceEvent);
    return () => {
      if (listenerRef.current) listenerRef.current();
    };
  }, []);

  // ─── 단일 도면 로딩 ─────────────────────────
  const loadDrawing = useCallback(async (params) => {
    const key = `${params.docno}_${params.docvr}`;
    setLoadingStates(prev => new Map(prev.set(key, true)));
    setErrors(prev => new Map(prev.set(key, null)));

    try {
      const result = await drawingLoaderService.loadDrawing(params);
      return result;
    } catch (error) {
      throw error;
    }
  }, []);

  // ─── 다양한 소스에서 로딩 ───────────────────
  const loadFromSearchResult = useCallback(async (searchResult) => {
    return loadDrawing({
      docno: searchResult.DOCNO,
      docvr: searchResult.DOCVR,
      source: 'search',
      metadata: { searchResult }
    });
  }, [loadDrawing]);

  const loadFromTree = useCallback(async (treeNode) => {
    return loadDrawing({
      docno: treeNode.ID,
      docvr: treeNode.DOCVR || '001',
      source: 'tree',
      metadata: { treeNode }
    });
  }, [loadDrawing]);

  const loadFromBookmark = useCallback(async (bookmark) => {
    return loadDrawing({
      docno: bookmark.DOCNO,
      docvr: bookmark.DOCVR,
      source: 'bookmark',
      metadata: { bookmark }
    });
  }, [loadDrawing]);

  // ─── 도면 새로고침 / 배치 로딩 ─────────────
  const refreshDrawing = useCallback(async (docno, docvr) => {
    return drawingLoaderService.refreshDrawing(docno, docvr);
  }, []);

  const loadMultipleDrawings = useCallback(async (drawingList, options) => {
    return drawingLoaderService.loadMultipleDrawings(drawingList, options);
  }, []);

  // ─── 캐시 관리 ─────────────────────────────
  const clearCache = useCallback((olderThanMs) => {
    drawingLoaderService.clearCache(olderThanMs);
    setStats(drawingLoaderService.getStats());
  }, []);

  // ─── 상태 조회 ─────────────────────────────
  const isLoading = useCallback((docno, docvr) => {
    const key = `${docno}_${docvr}`;
    return loadingStates.get(key) || false;
  }, [loadingStates]);

  const getError = useCallback((docno, docvr) => {
    const key = `${docno}_${docvr}`;
    return errors.get(key) || null;
  }, [errors]);

  return {
    loadDrawing,
    loadFromSearchResult,
    loadFromTree,
    loadFromBookmark,
    refreshDrawing,
    loadMultipleDrawings,
    isLoading,
    getError,
    stats,
    clearCache
  };
};

export default useDrawingLoader;
