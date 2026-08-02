## Dashboard (done? y)

The dashboard should provide a quick overview of financial performance for the week, month, and year.

The following data should be displayed:

* Income
* Expenses
* Current balance
* A chart showing where the money was spent, broken down by category

The data should also be compared with the monthly average for each category, calculated using all available data up to the present date. The dashboard should indicate whether spending is above the average and by how much, or how much remains before reaching or exceeding it.

A pie chart should also be implemented to show how each category contributed to total expenses.

In addition, another chart should compare the amount spent in a given month with the average spending for the same month in previous years.

## Data Entry (done? y)

The data-entry form should include:

* **Transaction type:** income or expense
* **Category:** to identify the category associated with the transaction
* **Date:** the transaction date, set to today by default
* **Notes:** a short comment providing additional details about the transaction



## Export (done? y)

The application must provide an export feature that allows users to extract financial transaction data according to a configurable set of filters.

### Date Range Selection

The user must be able to select the period covered by the export using one of the following options:

* A custom date range, by manually selecting a start date and an end date
* A specific calendar month
* Multiple consecutive or non-consecutive months
* An entire calendar year
* The complete transaction history, without applying any date restriction

When a custom date range is selected, the system must verify that the start date is earlier than or equal to the end date.

All transactions occurring on the selected start and end dates must be included in the exported data.

### Transaction Type Filter

The user must be able to choose which transaction types to include in the export:

* Income only
* Expenses only
* Both income and expenses

If no specific transaction type is selected, the system should include both income and expense transactions by default.

### Category Filter

The user must be able to select:

* All available categories
* One specific category
* Multiple selected categories

The user must also be able to exclude certain categories while keeping all the others selected.

Only transactions belonging to the included categories must appear in the exported file.

Disabled categories must still be available as export filters when they contain historical transactions. Disabling a category must not make its previous transactions unavailable.

### CSV File Generation

After applying the selected filters, the application must generate a CSV file containing all matching transactions.

Each row in the CSV file must represent a single financial transaction.

The exported file should include at least the following fields:

* Transaction ID
* Transaction type
* Category name
* Transaction date
* Amount
* Notes
* Transaction creation date
* Transaction last update date, when available

The first row of the CSV file must contain clear column headers.

The exported transactions should be ordered chronologically, preferably from the oldest transaction to the most recent one. Alternatively, the system may allow the user to choose the sorting order.

The CSV file must use a consistent date format and number format. For example:

* Dates: `YYYY-MM-DD`
* Decimal values: `1234.56`

Special characters, commas, quotation marks, accented characters, and line breaks contained in notes or category names must be correctly escaped to prevent the CSV structure from becoming invalid.

The file should use UTF-8 encoding to ensure compatibility with international characters and common spreadsheet applications.

The generated filename should clearly identify the export period. For example:

`transactions_2026-01-01_2026-12-31.csv`

Before generating the file, the interface should display a summary of the selected filters, including:

* Selected period
* Selected transaction types
* Included categories
* Excluded categories
* Total number of transactions that will be exported

If no transactions match the selected filters, the system should inform the user and avoid generating an empty file, unless empty exports are explicitly supported.

The export operation must not modify, delete, or alter any existing transaction data.

---

## Category Management (done? y)

The application must provide a category management feature that allows users to create, configure, enable, and disable transaction categories.

Categories are used to classify financial transactions and make income and expense data easier to organize, filter, analyze, and display in charts and reports.

### Category Creation

The user must be able to create a new category by providing at least:

* Category name
* Transaction type
* Category status

The transaction type must identify whether the category can be used for:

* Income transactions
* Expense transactions

For example:

* Salary: income category
* Freelance work: income category
* Groceries: expense category
* Rent: expense category
* Transportation: expense category

A category assigned to income transactions must not be selectable when creating an expense transaction. Similarly, an expense category must not be selectable when creating an income transaction.

The category name should be mandatory and should not contain only spaces.

The system should prevent the creation of duplicate category names within the same transaction type. For example, two expense categories named “Groceries” should not be allowed.

The system may allow the same name to exist once as an income category and once as an expense category, provided that categories are uniquely identified internally.

Each category should have a unique internal identifier that does not change when the category name is edited.

Optional category fields may include:

* Description
* Icon
* Color
* Display order
* Creation date
* Last update date

Icons and colors can be used to make charts, lists, and transaction forms easier to understand.

### Editing Categories

The user should be able to edit an existing category.

Editable information may include:

* Category name
* Description
* Icon
* Color
* Display order
* Enabled or disabled status

Changing a category name must automatically update how the category is displayed in all related transactions, reports, filters, and charts.

The system must maintain the relationship between the category and its existing transactions by using the category’s internal identifier rather than its name.

Changing the transaction type of a category should only be allowed when the category has no linked transactions.

For example, a category already used by expense transactions must not be converted into an income category, as this would make the historical data inconsistent.

### Enabling and Disabling Categories

Categories can be enabled or disabled at any time.

An enabled category must be available for selection when creating or editing a transaction of the corresponding type.

A disabled category must not be available for new transactions.

However, disabling a category must not affect historical data. Transactions already assigned to that category must remain visible in:

* Transaction history
* Dashboard data
* Charts
* Reports
* Search results
* Filters
* CSV exports

Disabled categories should be visually identified in the category management interface, for example with an “Inactive” or “Disabled” label.

When editing an old transaction associated with a disabled category, the system should continue to display the existing category. The user may either keep that category or replace it with another enabled category.

The system should display a confirmation message before disabling a category, especially when the category is linked to existing transactions.

### Category Deletion

A category can only be permanently deleted when no transactions are linked to it.

Before deleting a category, the system must calculate the number of associated transactions.

If the number of linked transactions is greater than zero, deletion must be blocked.

The interface should explain why the category cannot be deleted and should suggest disabling it instead.

For example:

“This category cannot be deleted because it is associated with 24 transactions. You can disable it to prevent it from being used for new transactions.”

If the category has zero linked transactions, the system may allow permanent deletion after displaying a confirmation message.

The confirmation should clearly explain that deletion is irreversible.

For example:

“Are you sure you want to permanently delete this category? This action cannot be undone.”

The deletion restriction must also be enforced at the database or backend level. It must not rely only on controls in the user interface.

### Category Usage Information

The category management page should display useful information for each category, such as:

* Category name
* Transaction type
* Enabled or disabled status
* Number of linked transactions
* Total amount associated with the category
* Date of the most recent transaction
* Available actions

Available actions may include:

* Edit
* Enable
* Disable
* Delete, only when permitted

The list should support searching, sorting, and filtering by:

* Category name
* Transaction type
* Status
* Number of linked transactions

### Data Integrity Rules

The system must ensure that every transaction is associated with a valid category of the correct transaction type.

An income transaction cannot be associated with an expense category.

An expense transaction cannot be associated with an income category.

Historical transactions must never lose their category reference when a category is disabled.

Category deletion must not leave transactions with missing or invalid category references.

All category changes should be validated both in the user interface and on the backend to ensure data integrity and prevent invalid operations.
