import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHttpError,
  formatUserActionError,
  isNetworkError,
  isTimeoutError,
  USER_ACTION_MESSAGES
} from '../src/utils/actionError.js';

describe('formatUserActionError', () => {
  it('maps Failed to fetch to a Russian server-unreachable message', () => {
    const err = new TypeError('Failed to fetch');
    assert.equal(
      formatUserActionError(err, 'Не удалось сохранить задачу'),
      USER_ACTION_MESSAGES.serverUnreachable
    );
  });

  it('maps abort/timeout to a wait-timeout message', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    assert.equal(isTimeoutError(err), true);
    assert.equal(
      formatUserActionError(err, 'Не удалось сохранить задачу'),
      USER_ACTION_MESSAGES.timeout
    );
  });

  it('appends a retry hint for create on Failed to fetch', () => {
    const err = new TypeError('Failed to fetch');
    const message = formatUserActionError(err, 'Не удалось сохранить задачу', {
      hint: USER_ACTION_MESSAGES.createRetryHint
    });
    assert.match(message, /Сервер не отвечает/);
    assert.match(message, /могла уже создаться/);
  });

  it('appends a retry hint when the API already localized a network error', () => {
    const err = new Error(USER_ACTION_MESSAGES.serverUnreachable);
    err.code = 'network';
    const message = formatUserActionError(err, 'Не удалось сохранить задачу', {
      hint: USER_ACTION_MESSAGES.createRetryHint
    });
    assert.match(message, /Сервер не отвечает/);
    assert.match(message, /могла уже создаться/);
  });

  it('keeps a localized server message', () => {
    const err = new Error('Назначьте сотрудника');
    err.status = 400;
    assert.equal(
      formatUserActionError(err, 'Не удалось сохранить задачу'),
      'Назначьте сотрудника'
    );
  });

  it('maps 503 html dump to server unavailable', () => {
    assert.equal(
      formatHttpError(503, '<html>Bad Gateway</html>', 'Не удалось сохранить задачу'),
      USER_ACTION_MESSAGES.serverUnavailable
    );
  });

  it('uses fallback for empty 400 body instead of a network error', () => {
    assert.equal(
      formatHttpError(400, '', 'Не удалось сохранить задачу'),
      'Не удалось сохранить задачу'
    );
  });

  it('does not treat a normal Russian error as a network failure', () => {
    assert.equal(isNetworkError(new Error('Не удалось удалить задачу')), false);
  });
});
