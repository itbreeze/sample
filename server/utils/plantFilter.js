const usePlantScopeFilter =
  String(process.env.USE_PLANT_SCOPE_FILTER || 'false').toLowerCase() === 'true';

const normalizePlantCode = (value) =>
  typeof value === 'string' ? value.trim() : '';

const extractPlantCode = (req) =>
  normalizePlantCode(
    (req.headers && req.headers['x-plant-code']) ||
      (req.body && req.body.plantCode) ||
      (req.query && req.query.plantCode) ||
      ''
  );

/**
 * Build plant filter SQL clause/binds based on request and config.
 * @param {object} req Express request
 * @param {string} columnAlias optional table alias prefix (default 'D')
 * @returns {{clause: string, binds: object, shouldFilter: boolean}}
 */
const buildPlantFilter = (req, columnAlias = 'D') => {
  const plantCode = extractPlantCode(req);
  const shouldFilter = usePlantScopeFilter && plantCode && plantCode !== '0001';

  if (!shouldFilter) {
    return { clause: '', binds: {}, shouldFilter: false };
  }

  const column = columnAlias ? `${columnAlias}.PLANTCODE` : 'PLANTCODE';
  return {
    clause: ` AND ${column} = :plantCode`,
    binds: { plantCode },
    shouldFilter: true,
  };
};

module.exports = {
  usePlantScopeFilter,
  buildPlantFilter,
};
