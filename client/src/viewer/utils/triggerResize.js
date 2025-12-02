export const triggerResize = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('resize'));
};
