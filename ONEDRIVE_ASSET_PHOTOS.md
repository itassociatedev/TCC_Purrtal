# Asset photo review and OneDrive setup

Asset records submitted with a photo remain drafts until IT approves them. Replacement photos and asset edits submitted with a photo also remain pending; the currently approved asset stays live until approval. Rejection deletes the private temporary image and retains the draft plus the optional review reason in the submission history.

After approval, the app uploads the image to the configured OneDrive branch folder. It stores the Graph drive-item ID and browser URL as metadata; the asset's image path points to an authenticated app endpoint that streams the image from OneDrive when the UI or export requests it. Approved image bytes are not kept on the web server. Pending images are kept only in Laravel's private storage at `storage/app/private/asset-photos/pending`.

The filename is the asset tag plus the submission ID (for example `GH-00034-456.jpg`; characters that are unsafe in file names become `-`, and `asset-<id>` is used if the asset has no tag). Each approved replacement is uploaded as a new version; after the database update succeeds, the prior Graph item is removed. This prevents a rejected or failed replacement from overwriting the current approved file. The database stores the Graph item ID, so editing an asset tag later does not break an existing photo.

Asset tags: when Add Asset or an Excel/CSV import has no tag, the next number for the branch is assigned (for example `GH-00378`; `AssetTagGenerator`). If the branch cannot be matched in an import, the old random `AST-` placeholder is still used.

## Branch folder mapping

Create the configured root folder in the target OneDrive, then create these three subfolders under it:

- `Greenhills` (`GH`)
- `Makati` (`MKT`)
- `Alabang` (`ALB`)

The branch is determined from the asset's branch value first, with the branch code in the asset tag as a fallback. Unknown branch values are left pending with an error rather than being uploaded into the wrong location.

## Microsoft Entra / Microsoft Graph setup

The integration uses the OAuth client-credentials flow, so it does not sign in as an employee for each image request. A tenant administrator must register or approve an application, grant application permission, and provide the app's tenant ID, client ID, and a client secret. Never commit secrets or send them in chat; enter them in the server's secret store or its untracked `.env` file.

The current endpoints can use either a selected SharePoint/OneDrive site ID (`ONEDRIVE_SITE_ID`) or the legacy user-drive identifier (`ONEDRIVE_USER_ID`). For a company tenant, prefer a restricted `Sites.Selected` application permission and an explicit read/write grant to the OneDrive site's site collection. This requires the tenant administrator to grant the selected site permission; the app must not be granted broad access by default. If the administrator chooses the broader `Files.ReadWrite.All` application permission instead, it requires tenant admin consent and grants access to files across site collections, so review that scope with IT first. Microsoft documents [client-credentials authentication](https://learn.microsoft.com/en-us/graph/auth-v2-service), [Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference), and [selected permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview).

Add the chosen configuration to the deployment environment:

```dotenv
ONEDRIVE_ENABLED=true
ONEDRIVE_TENANT_ID=your-tenant-id
ONEDRIVE_CLIENT_ID=your-application-client-id
ONEDRIVE_CLIENT_SECRET=your-secret-value
ONEDRIVE_SITE_ID=your-selected-onedrive-site-id
# Use ONEDRIVE_USER_ID instead only if the admin-approved permission model uses a user drive.
ONEDRIVE_FOLDER_PATH=TCC Purrtal/Asset Photos
ONEDRIVE_BRANCH_FOLDER_GH=Greenhills
ONEDRIVE_BRANCH_FOLDER_MKT=Makati
ONEDRIVE_BRANCH_FOLDER_ALB=Alabang
```

Use either the site ID or user ID endpoint supported by the permission model selected by IT. After configuration, clear Laravel's cached config or restart the app. Do not enable live OneDrive approval until the three folder paths and app permissions have been checked in a test tenant or test folder.

## Deployment and validation checklist

1. Apply the new additive database migration in the intended environment. It allows a pending new-asset submission to have no `asset_id` yet and stores the submitted asset fields until approval.
2. Create the root and branch folders in OneDrive and record the site ID for the selected OneDrive site.
3. Register the app, obtain tenant/client identifiers, set a secret or certificate in the host's secret manager, and grant the approved application permission. A tenant admin must perform consent and the selected-site grant if required.
4. Set the environment values above, restart/clear config, then upload a test photo for each branch.
5. Verify pending files stay private, rejection deletes the temporary file, approval creates the asset only after Graph upload succeeds, branch routing is correct, replacement keeps the old approved photo until successful review, and the asset details and export image links load through the authenticated app route.

The Microsoft Graph content API returns file content via a redirect to a preauthenticated URL. The app requests the Graph content endpoint server-side rather than persisting that temporary URL or using the item's `webUrl` as an image source. See [download driveItem content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0).
