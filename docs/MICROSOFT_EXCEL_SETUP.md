# Microsoft Excel Online integration setup

This integration uses Microsoft Graph with an Entra ID app and the OAuth 2.0 client-credentials flow. It is intended for Microsoft 365 organizational accounts; personal Microsoft accounts generally do not support this server app-only flow.

## 1. Choose the account

Use a Microsoft 365 work or school account for which the administrator can grant Graph application permissions. Confirm that Microsoft 365/OneDrive storage is licensed and that Excel for the web can open the workbook.

## 2. Register the Entra ID application

1. Open Microsoft Entra admin center and create or select an app registration.
2. Copy the Application (client) ID and Directory (tenant) ID.
3. Create a client secret under **Certificates & secrets** and copy it once.
4. Under **API permissions**, add `Sites.ReadWrite.All` or the narrowest organization-approved Files permission required for application access to the selected workbook, then grant tenant admin consent.

For the workbook API, Microsoft 365 app-only access commonly requires organization-admin consent and may require `Sites.ReadWrite.All`. Confirm the permission assigned by your tenant administrator.

## 3. Create the workbook

In OneDrive for the chosen Microsoft 365 account, create `Digital-Mitra-Leads.xlsx`. Create a table named `ContactLeads` and use these headers in this order:

1. Lead ID
2. Submission Date
3. Customer Name
4. Email
5. Mobile Number
6. Company
7. Interested Service
8. Project Budget
9. Project Message
10. Lead Status
11. Source

Use the ISO date/time text in Submission Date, or change its Excel format to `yyyy-mm-dd hh:mm:ss` after setup.

## 4. Obtain the IDs

Open the workbook in Excel Online and copy the item ID from the Graph/OneDrive API or the Microsoft 365 tenant's drive item tools. Configure `MS_DRIVE_ID` as the drive containing the workbook and `MS_WORKBOOK_ID` as that workbook item ID. Do not use credentials from browser network requests or put them in frontend code.

## 5. Configure the backend

Copy values into the existing backend environment only; do not commit secrets:

```dotenv
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
MS_DRIVE_ID=
MS_WORKBOOK_ID=
MS_TABLE_NAME=ContactLeads
MS_GRAPH_TIMEOUT_MS=15000
```

## 6. Safe test

Submit a labelled test enquiry through the existing contact form. In MongoDB verify the lead and `excelSync.status`, then confirm exactly one matching Lead ID row appears in the Excel table. Retry an intentionally failed test through the authorized admin enquiry screen and confirm it does not create a second row.
