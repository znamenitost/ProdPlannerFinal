import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenFileCombinedError,
  isFileNotFoundAgentError
} from '../src/utils/cdrPreviewErrors.js';

describe('open file errors', () => {
  it('detects agent file-not-found', () => {
    assert.equal(isFileNotFoundAgentError('file not found'), true);
    assert.equal(isFileNotFoundAgentError('HTTP 404'), true);
    assert.equal(isFileNotFoundAgentError('Failed to fetch'), false);
  });

  it('combines agent and netopen failures', () => {
    const message = formatOpenFileCombinedError(
      'file not found',
      '\\\\MINIMARKER\\Клиенты\\test.cdr',
      'Браузер заблокировал окно'
    );
    assert.match(message, /не найден/i);
    assert.match(message, /netopen/i);
    assert.match(message, /заблокировал/i);
  });
});
