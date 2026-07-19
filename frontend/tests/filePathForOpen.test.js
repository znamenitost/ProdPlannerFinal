import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureClientLetterPrefix,
  isClientLetterSegment,
  normalizeFolderPathForOpen,
  normalizePathForOpen
} from '../src/utils/filePathForOpen.js';

describe('filePathForOpen', () => {
  it('detects single-letter client bucket segment', () => {
    assert.equal(isClientLetterSegment('Ф'), true);
    assert.equal(isClientLetterSegment('Федерация'), false);
  });

  it('prepends letter from folder name when bucket is missing', () => {
    assert.equal(
      ensureClientLetterPrefix('Федерация Бодибилдинга/макет.cdr', 'Федерация Бодибилдинга'),
      'Ф/Федерация Бодибилдинга/макет.cdr'
    );
  });

  it('keeps path when letter bucket is already present', () => {
    assert.equal(
      ensureClientLetterPrefix('Ф/Федерация Бодибилдинга/макет.cdr'),
      'Ф/Федерация Бодибилдинга/макет.cdr'
    );
  });

  it('strips yandex disk root and prepends letter bucket', () => {
    const result = normalizePathForOpen(
      'C:\\Users\\пк\\Yandex.Disk\\Клиенты\\Федерация Бодибилдинга',
      'макет.cdr'
    );
    assert.equal(result, 'Ф/Федерация Бодибилдинга/макет.cdr');
  });

  it('keeps standard path with letter bucket after share', () => {
    const result = normalizePathForOpen(
      'C:/Users/пк/Yandex.Disk/Клиенты/Ф/Фрэшмемори',
      '18,05,26 конфеты.cdr'
    );
    assert.equal(result, 'Ф/Фрэшмемори/18,05,26 конфеты.cdr');
  });

  it('builds from short folder path without base root', () => {
    const result = normalizePathForOpen('Федерация Бодибилдинга', 'макет.cdr');
    assert.equal(result, 'Ф/Федерация Бодибилдинга/макет.cdr');
  });

  it('appends .cdr when file name has no extension', () => {
    const result = normalizePathForOpen(
      'C:\\Users\\пк\\Yandex.Disk\\Клиенты\\Ф\\Федерация Бодибилдинга',
      '11,06,26 тт'
    );
    assert.equal(result, 'Ф/Федерация Бодибилдинга/11,06,26 тт.cdr');
  });

  it('keeps .ai extension without appending .cdr', () => {
    const result = normalizePathForOpen('Федерация Бодибилдинга', 'макет.ai');
    assert.equal(result, 'Ф/Федерация Бодибилдинга/макет.ai');
  });

  it('normalizes folder path without appending file extension', () => {
    const result = normalizeFolderPathForOpen(
      'C:\\Users\\пк\\Yandex.Disk\\Клиенты\\Федерация Бодибилдинга'
    );
    assert.equal(result, 'Ф/Федерация Бодибилдинга');
  });

  it('keeps folder path when letter bucket is already present', () => {
    const result = normalizeFolderPathForOpen('Ф/Фрэшмемори');
    assert.equal(result, 'Ф/Фрэшмемори');
  });
});
