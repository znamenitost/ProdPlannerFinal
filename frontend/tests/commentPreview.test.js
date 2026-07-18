import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMENT_PREVIEW_SEPARATOR,
  normalizeCommentPreviewForDisplay,
  parseCommentPreviewLines
} from '../src/utils/commentPreview.js';

test('parseCommentPreviewLines keeps multiline comment as one block', () => {
  const preview = [
    'Базовая заметка',
    `Иван: первая строка\nвторая строка\nтретья`,
    'Мария → Иван: ответ'
  ].join(COMMENT_PREVIEW_SEPARATOR);

  const comments = parseCommentPreviewLines(preview);

  assert.equal(comments.length, 3);
  assert.equal(comments[0].text, 'Базовая заметка');
  assert.equal(comments[0].hideAuthor, true);
  assert.equal(comments[1].author, 'Иван');
  assert.equal(comments[1].text, 'первая строка\nвторая строка\nтретья');
  assert.equal(comments[2].author, 'Мария');
  assert.equal(comments[2].recipient, 'Иван');
  assert.equal(comments[2].text, 'ответ');
});

test('parseCommentPreviewLines legacy newline preview groups continuation lines', () => {
  const preview = [
    'Заметка',
    'Иван: строка 1',
    'строка 2',
    'строка 3',
    'Мария: коротко'
  ].join('\n');

  const comments = parseCommentPreviewLines(preview);

  assert.equal(comments.length, 3);
  assert.equal(comments[1].author, 'Иван');
  assert.equal(comments[1].text, 'строка 1\nстрока 2\nстрока 3');
  assert.equal(comments[2].author, 'Мария');
  assert.equal(comments[2].text, 'коротко');
});

test('normalizeCommentPreviewForDisplay replaces separator with newlines', () => {
  const preview = `a${COMMENT_PREVIEW_SEPARATOR}b`;
  assert.equal(normalizeCommentPreviewForDisplay(preview), 'a\nb');
});
