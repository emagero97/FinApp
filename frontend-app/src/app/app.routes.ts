import { Routes } from '@angular/router';
import { DashboardPageComponent } from './dashboard/dashboard-page.component';
import { CategoriesPageComponent } from './categories/categories-page.component';
import { ExportPageComponent } from './export/export-page.component';
import { TransactionsPageComponent } from './transactions/transactions-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'categories', component: CategoriesPageComponent },
  { path: 'transactions', component: TransactionsPageComponent },
  { path: 'export', component: ExportPageComponent },
  { path: '**', redirectTo: 'dashboard' },
];
