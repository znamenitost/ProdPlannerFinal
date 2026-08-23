import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as signalR from '@microsoft/signalr';
import {
  buildViewSubscriptionState,
  isTableViewTab,
  syncHubViewGroups
} from '../src/utils/hubViewSubscription.js';

function mockConnection() {
  const invocations = [];
  return {
    state: signalR.HubConnectionState.Connected,
    invocations,
    invoke(method, ...args) {
      invocations.push([method, ...args]);
      return Promise.resolve();
    }
  };
}

function adminState(activeTab, employee) {
  return buildViewSubscriptionState({
    activeTab,
    employee,
    userFullName: 'Admin',
    isAdmin: true
  });
}

describe('syncHubViewGroups calendar-viewers', () => {
  it('leaves previous calendar employee when admin switches on calendar tab', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(0, 'Дима'));

    prev = await syncHubViewGroups(conn, prev, adminState(0, 'Яромир'));

    assert.deepEqual(conn.invocations, [
      ['JoinCalendarViewers', 'Дима'],
      ['LeaveCalendarViewers', 'Дима'],
      ['JoinCalendarViewers', 'Яромир']
    ]);
    assert.equal(prev.lastJoinedCalendarEmployee, 'Яромир');
  });

  it('re-joins table viewers when already on table tab (reconnect/focus recovery)', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(1, 'Дима'));
    conn.invocations.length = 0;

    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Дима'));

    assert.deepEqual(conn.invocations, [['JoinTableViewers']]);
  });

  it('leaves calendar when admin opens table after viewing calendar', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(0, 'Дима'));

    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Дима'));

    assert.deepEqual(conn.invocations, [
      ['JoinCalendarViewers', 'Дима'],
      ['JoinTableViewers'],
      ['LeaveCalendarViewers', 'Дима']
    ]);
    assert.equal(prev.lastJoinedCalendarEmployee, null);
  });

  it('does not join stale employee when admin changes selection on table then opens calendar', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(0, 'Дима'));

    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Дима'));
    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Яромир'));
    conn.invocations.length = 0;

    prev = await syncHubViewGroups(conn, prev, adminState(0, 'Яромир'));

    assert.deepEqual(conn.invocations, [
      ['LeaveTableViewers'],
      ['JoinCalendarViewers', 'Яромир']
    ]);
    assert.equal(prev.lastJoinedCalendarEmployee, 'Яромир');
  });

  it('keeps table-viewers when switching between table and pickup tabs', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(1, 'Дима'));
    conn.invocations.length = 0;

    prev = await syncHubViewGroups(conn, prev, adminState(2, 'Дима'));

    assert.equal(isTableViewTab(2), true);
    assert.deepEqual(conn.invocations, [['JoinTableViewers']]);
    assert.equal(prev.lastJoinedCalendarEmployee, null);
  });

  it('leaves old calendar group when employee changes on table after calendar session', async () => {
    const conn = mockConnection();
    let prev = await syncHubViewGroups(conn, null, adminState(0, 'Дима'));
    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Дима'));

    prev = await syncHubViewGroups(conn, prev, adminState(1, 'Яромир'));
    assert.equal(prev.lastJoinedCalendarEmployee, null);

    conn.invocations.length = 0;
    prev = await syncHubViewGroups(conn, prev, adminState(0, 'Яромир'));

    assert.deepEqual(conn.invocations, [
      ['LeaveTableViewers'],
      ['JoinCalendarViewers', 'Яромир']
    ]);
  });
});
