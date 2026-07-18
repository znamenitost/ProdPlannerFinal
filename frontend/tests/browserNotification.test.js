import { describe, expect, it } from 'vitest';
import {
  browserNotificationForChat,
  browserNotificationForTask
} from '../src/utils/browserNotification.js';

describe('browserNotificationForTask', () => {
  it('builds comment payload with stable tag', () => {
    expect(browserNotificationForTask({
      type: 'TaskCommentAdded',
      taskId: 42,
      title: '+1 · Report'
    })).toEqual({
      title: '+1 · Report',
      body: 'В комментарии к задаче появилась запись',
      tag: 'comment-42',
      url: '/'
    });
  });

  it('builds new-task payload with deadline body', () => {
    expect(browserNotificationForTask({
      type: 'NewTask',
      taskId: 7,
      title: 'Cover',
      deadline: '18.07.2026, 15:00:00'
    })).toEqual({
      title: 'Cover',
      body: 'Дедлайн: 18.07.2026, 15:00:00',
      tag: 'task-NewTask-7',
      url: '/'
    });
  });
});

describe('browserNotificationForChat', () => {
  it('builds chat payload with conversation deep link', () => {
    expect(browserNotificationForChat({
      title: 'Иван',
      body: 'Привет',
      conversationId: '9'
    })).toEqual({
      title: 'Иван',
      body: 'Привет',
      tag: 'chat-9',
      url: '/?chat=9'
    });
  });
});
