import { useCallback, useEffect, useState } from 'react';
import {
  fetchMaxLinkStatus,
  createMaxLinkToken,
  unlinkMaxAccount,
  fetchMaxSubscribedTaskIds,
  subscribeTaskMax,
  unsubscribeTaskMax
} from '../utils/maxMessengerApi';

export default function useMaxMessenger(user) {
  const [linkStatus, setLinkStatus] = useState({
    linked: false,
    botConfigured: false,
    botUsername: null
  });
  const [subscribedTaskIds, setSubscribedTaskIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLinkStatus({ linked: false, botConfigured: false, botUsername: null });
      setSubscribedTaskIds([]);
      return;
    }

    setLoading(true);
    try {
      const [status, taskIds] = await Promise.all([
        fetchMaxLinkStatus(),
        fetchMaxSubscribedTaskIds().catch(() => [])
      ]);
      setLinkStatus({
        linked: Boolean(status?.linked),
        botConfigured: Boolean(status?.botConfigured),
        botUsername: status?.botUsername || null
      });
      setSubscribedTaskIds(Array.isArray(taskIds) ? taskIds : []);
    } catch {
      setLinkStatus({ linked: false, botConfigured: false, botUsername: null });
      setSubscribedTaskIds([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestLinkToken = useCallback(async () => {
    const token = await createMaxLinkToken();
    await refresh();
    return token;
  }, [refresh]);

  const unlink = useCallback(async () => {
    await unlinkMaxAccount();
    await refresh();
  }, [refresh]);

  const toggleTaskSubscription = useCallback(async (taskId, nextSubscribed) => {
    if (nextSubscribed) {
      await subscribeTaskMax(taskId);
      setSubscribedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    } else {
      await unsubscribeTaskMax(taskId);
      setSubscribedTaskIds((prev) => prev.filter((id) => id !== taskId));
    }
  }, []);

  const isTaskSubscribed = useCallback(
    (taskId) => subscribedTaskIds.includes(Number(taskId)),
    [subscribedTaskIds]
  );

  return {
    linkStatus,
    subscribedTaskIds,
    loading,
    refresh,
    requestLinkToken,
    unlink,
    toggleTaskSubscription,
    isTaskSubscribed,
    canSubscribe: linkStatus.linked && linkStatus.botConfigured
  };
}
