export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: number;
  type: TransactionType;
  category_id: number;
  category_name: string | null;
  amount: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  type: TransactionType;
  category_id: number;
  amount: number;
  date: string;
  notes?: string | null;
}

export interface TransactionQuery {
  type?: TransactionType;
  category_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
}
