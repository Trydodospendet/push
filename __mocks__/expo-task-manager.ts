/** Manual Jest mock: tasks are only registered, never run. */
export const defineTask = jest.fn();
export const isTaskDefined = jest.fn(() => true);
