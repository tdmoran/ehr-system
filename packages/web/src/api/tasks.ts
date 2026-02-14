import { request } from './request';
import type { PatientTask, CreateTaskInput } from './types';

export const tasksApi = {
  getTasks: (completed?: boolean) =>
    request<{ tasks: PatientTask[] }>(
      `/tasks${completed !== undefined ? `?completed=${completed}` : ''}`
    ),

  getPatientTasks: (patientId: string) =>
    request<{ tasks: PatientTask[] }>(`/tasks/patient/${patientId}`),

  createTask: (task: CreateTaskInput) =>
    request<{ task: PatientTask }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  updateTask: (id: string, completed: boolean) =>
    request<{ task: { id: string; completed: boolean; completed_at: string | null } }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
};
