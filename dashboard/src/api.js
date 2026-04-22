import { debug } from './debug.js';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const start = Date.now();
  let response;

  try {
    const res = await fetch(path, opts);
    response = await res.json();
    debug.api(method, path, body, response, Date.now() - start);

    if (!response.ok) {
      const err = new Error(response.message || response.code || 'Request failed');
      err.code = response.code;
      err.status = res.status;
      throw err;
    }
    return response;
  } catch (err) {
    if (!response) {
      // Network-level failure (no response parsed yet)
      debug.api(method, path, body, { networkError: err.message }, Date.now() - start);
    }
    debug.error(`API ${method} ${path}`, err);
    throw err;
  }
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};
