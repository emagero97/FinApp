export type CategoryType = 'income' | 'expense';
export type CategoryStatus = 'enabled' | 'disabled';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  status: CategoryStatus;
  parent_id: number | null;
  parent_name: string | null;
  child_count: number;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number | null;
  transaction_count: number;
  total_amount: string;
  last_transaction_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  status: CategoryStatus;
  parent_id?: number | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  display_order?: number | null;
}

export interface CategoryQuery {
  search?: string;
  type?: CategoryType;
  status?: CategoryStatus;
  parentId?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
}
