export const formatLayerName = (layer) => {
  if (layer === null || layer === undefined) return '';
  const trimmed = String(layer).trim();
  if (!trimmed) return '';
  if (trimmed === 'ZeroLayerName') return '0';
  return trimmed;
};
