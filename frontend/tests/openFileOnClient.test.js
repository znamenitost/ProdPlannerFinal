import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOpenFileCombinedError,
  formatFileOpenError,
  isFileNotFoundAgentError,
  shouldTryNetopenAfterAgentFailure
} from '../src/utils/cdrPreviewErrors.js';

describe('open file errors', () => {
  it('detects agent file-not-found', () => {
    assert.equal(isFileNotFoundAgentError('file not found'), true);
    assert.equal(isFileNotFoundAgentError('HTTP 404'), true);
    assert.equal(isFileNotFoundAgentError('Failed to fetch'), false);
  });

  it('does not netopen after agent file-not-found', () => {
    assert.equal(shouldTryNetopenAfterAgentFailure('file not found'), false);
    assert.equal(shouldTryNetopenAfterAgentFailure('HTTP 404'), false);
    assert.equal(shouldTryNetopenAfterAgentFailure('Failed to fetch'), true);
    assert.equal(shouldTryNetopenAfterAgentFailure('read path not allowed'), false);
  });

  it('formats file-not-found for UI', () => {
    const message = formatFileOpenError('file not found', '\\\\MINIMARKER\\Клиенты\\test.cdr');
    assert.match(message, /не найден/i);
    assert.doesNotMatch(message, /netopen/i);
  });

  it('combines agent unreachable and netopen failures', () => {
    const message = formatOpenFileCombinedError(
      'Failed to fetch',
      '\\\\MINIMARKER\\Клиенты\\test.cdr',
      'Браузер заблокировал окно'
    );
    assert.match(message, /агент/i);
    assert.match(message, /заблокировал/i);
  });
});
