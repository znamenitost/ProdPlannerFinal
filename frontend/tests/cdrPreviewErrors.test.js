import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCdrPreviewPersistError,
  formatCdrPreviewReadError,
  getCdrPathValidationError,
  getTaskFilePathHint,
  isAgentUnavailableWarning,
  isFileNotFoundAgentError
} from '../src/utils/cdrPreviewErrors.js';

describe('cdrPreviewErrors', () => {
  it('requires file name', () => {
    assert.equal(
      getTaskFilePathHint('Клиент/2024', ''),
      'Укажите имя файла для открытия и превью'
    );
    assert.equal(
      getCdrPathValidationError('Клиент/2024', ''),
      'Укажите имя файла для открытия и превью'
    );
  });

  it('appends .cdr when extension is missing', () => {
    assert.equal(getCdrPathValidationError('Федерация Бодибилдинга', '11,06,26 тт'), null);
  });

  it('rejects non-cdr extension', () => {
    assert.match(
      getCdrPathValidationError('Клиент/2024', 'layout.ai'),
      /\.cdr/
    );
  });

  it('accepts valid cdr path with letter bucket inference', () => {
    assert.equal(getCdrPathValidationError('Федерация Бодибилдинга', 'layout.cdr'), null);
  });

  it('localizes file not found from agent', () => {
    const message = formatCdrPreviewReadError('file not found', '\\\\MINIMARKER\\Клиенты\\test.cdr');
    assert.match(message, /не найден/i);
    assert.match(message, /test\.cdr/);
  });

  it('explains unreachable agent', () => {
    const message = formatCdrPreviewReadError('Failed to fetch', '\\\\MINIMARKER\\Клиенты\\test.cdr');
    assert.match(message, /агент недоступен/i);
    assert.match(message, /аватар/i);
    assert.equal(isAgentUnavailableWarning(message), true);
  });

  it('does not treat file-not-found as agent warning', () => {
    const message = formatCdrPreviewReadError('file not found', '\\\\MINIMARKER\\Клиенты\\test.cdr');
    assert.equal(isAgentUnavailableWarning(message), false);
  });

  it('detects agent file-not-found helper', () => {
    assert.equal(isFileNotFoundAgentError('file not found'), true);
    assert.equal(isFileNotFoundAgentError('HTTP 404'), true);
  });

  it('maps HTTP 404', () => {
    const message = formatCdrPreviewReadError('HTTP 404', '\\\\MINIMARKER\\Клиенты\\test.cdr');
    assert.match(message, /не найден/i);
  });

  it('passes through known persist errors', () => {
    assert.equal(
      formatCdrPreviewPersistError('Превью слишком большое'),
      'Превью слишком большое'
    );
  });

  it('wraps unknown persist errors', () => {
    assert.match(
      formatCdrPreviewPersistError('ImageSharp unknown'),
      /Не удалось сохранить превью/
    );
  });
});
