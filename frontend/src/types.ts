export interface Ticket {
  id: number;
  task_name: string;
  task_owner: string | null;
  description: string | null;
  status: string;
}

export type ColumnType = 'Backlog' | 'In Progress' | 'Review' | 'Done';
