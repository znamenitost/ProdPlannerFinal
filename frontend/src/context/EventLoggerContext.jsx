import React, { createContext, useContext, useState, useCallback } from 'react';

const EventLoggerContext = createContext();

export const EventLoggerProvider = ({ children }) => {
  const [events, setEvents] = useState([]);

  const logEvent = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newEvent = { id: Date.now() + Math.random(), timestamp, message, type };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return (
    <EventLoggerContext.Provider value={{ events, logEvent, clearEvents }}>
      {children}
    </EventLoggerContext.Provider>
  );
};

export const useEventLogger = () => {
  const context = useContext(EventLoggerContext);
  if (!context) throw new Error('useEventLogger must be used within EventLoggerProvider');
  return context;
};