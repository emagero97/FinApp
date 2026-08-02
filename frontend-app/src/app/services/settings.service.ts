import { effect, Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'it';

const THEME_KEY = 'finapp.theme';
const LANG_KEY = 'finapp.lang';

const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.transactions': 'Transactions',
    'nav.categories': 'Categories',
    'nav.export': 'Export',
    'nav.collapse': 'Collapse',
    'nav.expand': 'Expand menu',
    'nav.collapseTitle': 'Collapse menu',
    'nav.theme': 'Toggle theme',
    'nav.themeTitleLight': 'Switch to light theme',
    'nav.themeTitleDark': 'Switch to dark theme',
    'nav.language': 'Switch language',

    'dash.tagline': 'Your money situation, day by day.',
    'dash.week': 'Week',
    'dash.month': 'Month',
    'dash.year': 'Year',
    'dash.balance': 'Balance',
    'dash.income': 'Income',
    'dash.expenses': 'Expenses',
    'dash.spendByCategory': 'Spending by category',
    'dash.thisMonth': 'This month',
    'dash.noExpensesMonth': 'No expenses recorded this month.',
    'dash.totalSpent': 'total spent',
    'dash.catVsAvg': 'Categories vs monthly average',
    'dash.catVsAvgSub': 'This month compared to your historical monthly average',
    'dash.noExpenseHistory': 'No expense history yet.',
    'dash.overBy': 'over by',
    'dash.belowAvg': 'below avg',
    'dash.average': 'Average',
    'dash.monthVsYears': 'This month vs previous years',
    'dash.monthVsYearsSub': 'Total expenses across the years',
    'dash.noData': 'No data.',
    'dash.avg': 'avg',
    'dash.last12': 'Last 12 months',
    'dash.last12Sub': 'Monthly expenses trend',

    'tx.tagline': 'Add and manage your income and expenses.',
    'tx.type': 'Type',
    'tx.category': 'Category',
    'tx.select': 'Select…',
    'tx.disabled': 'disabled',
    'tx.noCategories': 'No {type} categories. Create one first.',
    'tx.date': 'Date',
    'tx.amount': 'Amount',
    'tx.notes': 'Notes',
    'tx.optional': 'Optional',
    'tx.editing': 'Editing transaction',
    'tx.cancel': 'Cancel',
    'tx.reset': 'Reset',
    'tx.update': 'Update',
    'tx.add': 'Add',
    'tx.saving': 'Saving…',
    'tx.loading': 'Loading…',
    'tx.none': 'No transactions yet. Add one above.',
    'tx.edit': 'Edit',
    'tx.delete': 'Delete',
    'tx.searchPlaceholder': 'Search by amount, notes or category…',
    'tx.allTypes': 'All types',
    'tx.allCategories': 'All categories',
    'tx.from': 'From',
    'tx.to': 'To',
    'tx.clearFilters': 'Clear filters',
    'tx.deleteQuestion': 'Delete transaction?',
    'tx.deleteMsg':
      'Are you sure you want to delete this {type} of {amount} on {date}? This action cannot be undone.',

    'export.header': 'Export',
    'export.tagline': 'Extract your transactions to a CSV file.',
    'export.period': 'Period',
    'export.periodAll': 'All history',
    'export.periodYear': 'A calendar year',
    'export.periodMonth': 'A specific month',
    'export.periodMonths': 'Multiple months',
    'export.periodCustom': 'Custom range',
    'export.year': 'Year',
    'export.month': 'Month',
    'export.multiMonths': 'Select months',
    'export.customFrom': 'Start date',
    'export.customTo': 'End date',
    'export.customInvalid': 'Start date must not be after the end date.',
    'export.type': 'Transaction type',
    'export.typeBoth': 'Income & expenses',
    'export.typeIncome': 'Income only',
    'export.typeExpense': 'Expenses only',
    'export.categories': 'Categories',
    'export.selectAll': 'Select all',
    'export.selectNone': 'Select none',
    'export.allSelected': 'All selected',
    'export.disabled': 'disabled',
    'export.noCategories': 'No categories available.',
    'export.summary': 'Export summary',
    'export.sumPeriod': 'Period',
    'export.sumType': 'Types',
    'export.sumIncluded': 'Included categories',
    'export.sumExcluded': 'Excluded categories',
    'export.sumRows': 'Total rows',
    'export.none': 'none',
    'export.loading': 'Loading…',
    'export.noMatching': 'No transactions match these filters.',
    'export.noMatches': 'There are no transactions to export for the selected filters.',
    'export.generate': 'Export CSV',
    'export.downloading': 'Preparing…',
    'export.downloaded': 'Export downloaded successfully.',
    'export.downloadError': 'Could not create the export. Please try again.',

    'cat.new': 'New category',
    'cat.edit': 'Edit category',
    'cat.name': 'Name',
    'cat.nameRequired': 'Name is required and cannot be blank',
    'cat.type': 'Transaction type *',
    'cat.expense': 'Expense',
    'cat.income': 'Income',
    'cat.typeLocked':
      'Type cannot change because this category is linked to transactions or has subcategories.',
    'cat.parent': 'Parent category',
    'cat.none': 'None (top-level category)',
    'cat.parentLocked': 'Cannot move a category that has subcategories.',
    'cat.status': 'Status *',
    'cat.enabled': 'Enabled',
    'cat.disabled': 'Disabled',
    'cat.icon': 'Icon',
    'cat.color': 'Color',
    'cat.displayOrder': 'Display order',
    'cat.description': 'Description',
    'cat.save': 'Save',
    'cat.cancel': 'Cancel',
    'cat.allTypes': 'All types',
    'cat.allStatuses': 'All statuses',
    'cat.search': 'Search categories…',
    'cat.sortName': 'Sort: name',
    'cat.sortType': 'Sort: type',
    'cat.sortStatus': 'Sort: status',
    'cat.sortTx': 'Sort: transactions',
    'cat.sortOrder': 'Sort: display order',
    'cat.noneFound': 'No categories found.',
    'cat.header': 'Categories',
    'cat.newBtn': 'New category',
    'cat.colName': 'Name',
    'cat.colType': 'Type',
    'cat.colStatus': 'Status',
    'cat.colTx': 'Transactions',
    'cat.colAmount': 'Total amount',
    'cat.colLast': 'Last transaction',
    'cat.colActions': 'Actions',
    'cat.enable': 'Enable',
    'cat.disable': 'Disable',
    'cat.delete': 'Delete',
    'cat.deletePermanent': 'Delete permanently',
    'cat.cannotDelete': 'Cannot delete a category with linked transactions or subcategories',
    'cat.deleteTitle': 'Delete category?',
    'cat.deleteCantTitle': 'Category cannot be deleted',
    'cat.deleteLinkedMsg':
      'This category cannot be deleted because it is associated with {count} transactions. You can disable it to prevent it from being used for new transactions.',
    'cat.deleteChildrenMsg':
      'This category cannot be deleted because it has {count} {sub}. Remove or reassign them first.',
    'cat.deleteConfirm': 'Are you sure you want to permanently delete "{name}"? This action cannot be undone.',
    'cat.disableTitle': 'Disable category?',
    'cat.enableTitle': 'Enable category?',
    'cat.disableWarn':
      'This category is linked to {count} transactions. Disabling it will not remove historical data; it will only prevent it from being used for new transactions.',
    'cat.ok': 'OK',
    'cat.error': 'Something went wrong. Please try again.',
  },
  it: {
    'nav.dashboard': 'Dashboard',
    'nav.transactions': 'Transazioni',
    'nav.categories': 'Categorie',
    'nav.export': 'Esporta',
    'nav.collapse': 'Comprimi',
    'nav.expand': 'Espandi menu',
    'nav.collapseTitle': 'Comprimi menu',
    'nav.theme': 'Cambia tema',
    'nav.themeTitleLight': 'Passa al tema chiaro',
    'nav.themeTitleDark': 'Passa al tema scuro',
    'nav.language': 'Cambia lingua',

    'dash.tagline': 'La tua situazione finanziaria, giorno per giorno.',
    'dash.week': 'Settimana',
    'dash.month': 'Mese',
    'dash.year': 'Anno',
    'dash.balance': 'Saldo',
    'dash.income': 'Entrate',
    'dash.expenses': 'Uscite',
    'dash.spendByCategory': 'Spese per categoria',
    'dash.thisMonth': 'Questo mese',
    'dash.noExpensesMonth': 'Nessuna spesa registrata questo mese.',
    'dash.totalSpent': 'totale speso',
    'dash.catVsAvg': 'Categorie vs media mensile',
    'dash.catVsAvgSub': 'Questo mese confrontato con la tua media mensile storica',
    'dash.noExpenseHistory': 'Nessuna cronologia spese.',
    'dash.overBy': 'oltre di',
    'dash.belowAvg': 'sotto la media',
    'dash.average': 'Media',
    'dash.monthVsYears': 'Questo mese vs anni precedenti',
    'dash.monthVsYearsSub': 'Spese totali nel corso degli anni',
    'dash.noData': 'Nessun dato.',
    'dash.avg': 'media',
    'dash.last12': 'Ultimi 12 mesi',
    'dash.last12Sub': 'Andamento delle spese mensili',

    'tx.tagline': 'Aggiungi e gestisci entrate e uscite.',
    'tx.type': 'Tipo',
    'tx.category': 'Categoria',
    'tx.select': 'Seleziona…',
    'tx.disabled': 'disattivata',
    'tx.noCategories': 'Nessuna categoria {type}. Creane una prima.',
    'tx.date': 'Data',
    'tx.amount': 'Importo',
    'tx.notes': 'Note',
    'tx.optional': 'Facoltativo',
    'tx.editing': 'Modifica transazione',
    'tx.cancel': 'Annulla',
    'tx.reset': 'Azzera',
    'tx.update': 'Aggiorna',
    'tx.add': 'Aggiungi',
    'tx.saving': 'Salvataggio…',
    'tx.loading': 'Caricamento…',
    'tx.none': 'Ancora nessuna transazione. Aggiungine una qui sopra.',
    'tx.edit': 'Modifica',
    'tx.delete': 'Elimina',
    'tx.searchPlaceholder': 'Cerca per importo, note o categoria…',
    'tx.allTypes': 'Tutti i tipi',
    'tx.allCategories': 'Tutte le categorie',
    'tx.from': 'Da',
    'tx.to': 'A',
    'tx.clearFilters': 'Azzera filtri',
    'tx.deleteQuestion': 'Eliminare la transazione?',
    'tx.deleteMsg':
      'Vuoi eliminare questa transazione di {type} di {amount} il {date}? Questa azione non può essere annullata.',

    'export.header': 'Esporta',
    'export.tagline': 'Estrai le tue transazioni in un file CSV.',
    'export.period': 'Periodo',
    'export.periodAll': 'Tutta la cronologia',
    'export.periodYear': 'Un anno civile',
    'export.periodMonth': 'Un mese specifico',
    'export.periodMonths': 'Più mesi',
    'export.periodCustom': 'Intervallo personalizzato',
    'export.year': 'Anno',
    'export.month': 'Mese',
    'export.multiMonths': 'Seleziona i mesi',
    'export.customFrom': 'Data inizio',
    'export.customTo': 'Data fine',
    'export.customInvalid': 'La data di inizio non deve essere successiva alla data di fine.',
    'export.type': 'Tipo di transazione',
    'export.typeBoth': 'Entrate e uscite',
    'export.typeIncome': 'Solo entrate',
    'export.typeExpense': 'Solo uscite',
    'export.categories': 'Categorie',
    'export.selectAll': 'Seleziona tutte',
    'export.selectNone': 'Deseleziona tutte',
    'export.allSelected': 'Tutte selezionate',
    'export.disabled': 'disattivata',
    'export.noCategories': 'Nessuna categoria disponibile.',
    'export.summary': 'Riepilogo esportazione',
    'export.sumPeriod': 'Periodo',
    'export.sumType': 'Tipi',
    'export.sumIncluded': 'Categorie incluse',
    'export.sumExcluded': 'Categorie escluse',
    'export.sumRows': 'Righe totali',
    'export.none': 'nessuna',
    'export.loading': 'Caricamento…',
    'export.noMatching': 'Nessuna transazione corrisponde a questi filtri.',
    'export.noMatches': 'Non ci sono transazioni da esportare per i filtri selezionati.',
    'export.generate': 'Esporta CSV',
    'export.downloading': 'Preparazione…',
    'export.downloaded': 'Esportazione completata con successo.',
    'export.downloadError': 'Impossibile creare l’esportazione. Riprova.',

    'cat.new': 'Nuova categoria',
    'cat.edit': 'Modifica categoria',
    'cat.name': 'Nome',
    'cat.nameRequired': 'Il nome è obbligatorio e non può essere vuoto',
    'cat.type': 'Tipo di transazione *',
    'cat.expense': 'Uscita',
    'cat.income': 'Entrata',
    'cat.typeLocked':
      'Il tipo non può cambiare perché questa categoria è collegata a transazioni o ha sottocategorie.',
    'cat.parent': 'Categoria padre',
    'cat.none': 'Nessuna (categoria di primo livello)',
    'cat.parentLocked': 'Non puoi spostare una categoria che ha sottocategorie.',
    'cat.status': 'Stato *',
    'cat.enabled': 'Attiva',
    'cat.disabled': 'Disattivata',
    'cat.icon': 'Icona',
    'cat.color': 'Colore',
    'cat.displayOrder': 'Ordinamento',
    'cat.description': 'Descrizione',
    'cat.save': 'Salva',
    'cat.cancel': 'Annulla',
    'cat.allTypes': 'Tutti i tipi',
    'cat.allStatuses': 'Tutti gli stati',
    'cat.search': 'Cerca categorie…',
    'cat.sortName': 'Ordina: nome',
    'cat.sortType': 'Ordina: tipo',
    'cat.sortStatus': 'Ordina: stato',
    'cat.sortTx': 'Ordina: transazioni',
    'cat.sortOrder': 'Ordina: ordinamento',
    'cat.noneFound': 'Nessuna categoria trovata.',
    'cat.header': 'Categorie',
    'cat.newBtn': 'Nuova categoria',
    'cat.colName': 'Nome',
    'cat.colType': 'Tipo',
    'cat.colStatus': 'Stato',
    'cat.colTx': 'Transazioni',
    'cat.colAmount': 'Importo totale',
    'cat.colLast': 'Ultima transazione',
    'cat.colActions': 'Azioni',
    'cat.enable': 'Attiva',
    'cat.disable': 'Disattiva',
    'cat.delete': 'Elimina',
    'cat.deletePermanent': 'Elimina definitivamente',
    'cat.cannotDelete': 'Impossibile eliminare una categoria con transazioni o sottocategorie collegate',
    'cat.deleteTitle': 'Eliminare la categoria?',
    'cat.deleteCantTitle': 'La categoria non può essere eliminata',
    'cat.deleteLinkedMsg':
      'Questa categoria non può essere eliminata perché è associata a {count} transazioni. Puoi disattivarla per impedirne l’uso per nuove transazioni.',
    'cat.deleteChildrenMsg':
      'Questa categoria non può essere eliminata perché ha {count} {sub}. Rimuovile o riassegnale prima.',
    'cat.deleteConfirm':
      'Vuoi eliminare definitivamente "{name}"? Questa azione non può essere annullata.',
    'cat.disableTitle': 'Disattivare la categoria?',
    'cat.enableTitle': 'Attivare la categoria?',
    'cat.disableWarn':
      'Questa categoria è collegata a {count} transazioni. Disattivarla non rimuoverà i dati storici; impedirà solo l’uso per nuove transazioni.',
    'cat.ok': 'OK',
    'cat.error': 'Qualcosa è andato storto. Riprova.',
  },
};

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`
  );
}

function readStored(key: string): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable — ignore
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly theme = signal<Theme>((readStored(THEME_KEY) as Theme) ?? 'dark');
  readonly language = signal<Language>((readStored(LANG_KEY) as Language) ?? 'en');

  constructor() {
    effect(() => {
      const theme = this.theme();
      writeStored(THEME_KEY, theme);
      this.applyTheme(theme);
    });
    effect(() => {
      const lang = this.language();
      writeStored(LANG_KEY, lang);
      this.rewriteDocument();
    });
  }

  apply(): void {
    this.applyTheme(this.theme());
    this.rewriteDocument();
  }

  t(key: string, params?: Record<string, string | number>): string {
    const value = DICTIONARY[this.language()][key] ?? DICTIONARY.en[key] ?? key;
    return interpolate(value, params);
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  setLanguage(language: Language): void {
    this.language.set(language);
  }

  toggleLanguage(): void {
    this.language.update((current) => (current === 'en' ? 'it' : 'en'));
  }

  private applyTheme(theme: Theme): void {
    if (typeof window === 'undefined') {
      return;
    }
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }

  private rewriteDocument(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.document.documentElement.setAttribute('lang', this.language());
  }
}