/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function statusForError(e) {
  const msg = e instanceof Error ? e.message : 'Server error';
  if (msg === 'Permission denied') return 403;
  if (msg === 'Not logged in') return 401;
  return 500;
}

/** Wrap async API handlers so unexpected rejections return JSON errors instead of hanging. */
export function wrapAsyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((e) => {
      if (res.headersSent) return;
      const msg = e instanceof Error ? e.message : 'Server error';
      res.statusCode = statusForError(e);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: msg }));
    });
  };
}