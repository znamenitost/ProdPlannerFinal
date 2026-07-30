import * as signalR from '@microsoft/signalr';

/**
 * Календарь, на который подписываемся: свой для сотрудника, выбранный — для админа.
 */
export function resolveCalendarEmployee({ activeTab, employee, userFullName, isAdmin }) {
  if (activeTab !== 0) return null;
  if (isAdmin) {
    const selected = String(employee || '').trim();
    return selected || null;
  }
  const selfName = String(userFullName || '').trim();
  return selfName || null;
}

async function invokeSafe(connection, method, ...args) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) return false;
  try {
    await connection.invoke(method, ...args);
    return true;
  } catch (err) {
    console.warn(`SignalR ${method} failed:`, err?.message ?? err);
    return false;
  }
}

/**
 * Синхронизирует группы table-viewers / calendar-viewers:{имя} с открытой вкладкой.
 * @returns состояние для следующего вызова (включая lastJoinedCalendarEmployee);
 * joinFailed=true — вступление в группу не подтверждено, нужна повторная попытка.
 */
export async function syncHubViewGroups(connection, previous, next) {
  if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
    return {
      ...next,
      lastJoinedCalendarEmployee: previous?.lastJoinedCalendarEmployee ?? null,
      joinFailed: true
    };
  }

  const wasTable = previous?.activeTab === 1;
  const isTable = next.activeTab === 1;
  const prevJoined = previous?.lastJoinedCalendarEmployee ?? null;
  const nextJoined = next.activeTab === 0 ? next.calendarEmployee : null;
  let joinFailed = false;

  if (wasTable && !isTable) {
    await invokeSafe(connection, 'LeaveTableViewers');
  }
  if (isTable) {
    joinFailed = !(await invokeSafe(connection, 'JoinTableViewers')) || joinFailed;
  }

  if (prevJoined && prevJoined !== nextJoined) {
    await invokeSafe(connection, 'LeaveCalendarViewers', prevJoined);
  }
  if (nextJoined) {
    joinFailed = !(await invokeSafe(connection, 'JoinCalendarViewers', nextJoined)) || joinFailed;
  }

  return {
    ...next,
    lastJoinedCalendarEmployee: nextJoined,
    joinFailed
  };
}

export function buildViewSubscriptionState({ activeTab, employee, userFullName, isAdmin }) {
  return {
    activeTab,
    calendarEmployee: resolveCalendarEmployee({ activeTab, employee, userFullName, isAdmin })
  };
}
