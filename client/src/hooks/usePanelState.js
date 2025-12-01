import { useState, useCallback } from 'react';

export const usePanelState = ({ onBookmarkOpen } = {}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(null);
  const [isPanelMaximized, setIsPanelMaximized] = useState(true);

  const openPanel = useCallback(
    async (menuId, config = {}) => {
      setActiveMenuItem(menuId);
      setIsPanelMaximized(config.startsMaximized ?? true);
      if (menuId === 'bookmark' && typeof onBookmarkOpen === 'function') {
        await onBookmarkOpen();
      }
    },
    [onBookmarkOpen]
  );

  const closePanel = useCallback(() => {
    setActiveMenuItem(null);
    setIsSidebarOpen(false);
  }, []);

  const isPanelOpen = Boolean(activeMenuItem);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    activeMenuItem,
    setActiveMenuItem,
    isPanelMaximized,
    setIsPanelMaximized,
    isPanelOpen,
    openPanel,
    closePanel,
  };
};
