import { createContext, useContext } from 'react';
import { TASK_TABLE_DEFAULT_TEXT_LIMIT } from '../constants/taskTableColumnsConfig';

const TextLimitContext = createContext(TASK_TABLE_DEFAULT_TEXT_LIMIT);

export const TextLimitProvider = TextLimitContext.Provider;

export function useTextLimit() {
  return useContext(TextLimitContext);
}
