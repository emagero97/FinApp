import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'categories',
    renderMode: RenderMode.Client
  },
  {
    path: 'transactions',
    renderMode: RenderMode.Client
  },
  {
    path: 'export',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
