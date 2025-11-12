import React from 'react';

const escapeRegExp = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Highlight each word inside `highlight` within the provided `value`.
 * Returns the original string when no highlight terms exist or when the value is empty.
 */
export const highlightText = (value, highlight) => {
  if (!highlight || value == null) return value;

  const text = typeof value === 'string' ? value : String(value);
  if (!text) return value;

  const terms = highlight.split(/\s+/).map((term) => term.trim()).filter(Boolean);
  if (terms.length === 0) return text;

  let processed = [text];

  terms.forEach((term, termIndex) => {
    const safeTerm = escapeRegExp(term);
    if (!safeTerm) return;
    const regex = new RegExp(`(${safeTerm})`, 'gi');

    processed = processed.flatMap((chunk, chunkIndex) => {
      if (typeof chunk !== 'string') return chunk;
      return chunk.split(regex).map((part, partIndex) => {
        if (typeof part !== 'string') return part;
        if (part.toLowerCase() === term.toLowerCase()) {
          return (
            <mark key={`${termIndex}-${chunkIndex}-${partIndex}`}>{part}</mark>
          );
        }
        return part;
      });
    });
  });

  return processed;
};
