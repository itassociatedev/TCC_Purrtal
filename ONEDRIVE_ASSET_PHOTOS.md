# OneDrive asset photo setup

The asset photo workflow uploads approved photos to OneDrive through Microsoft Graph. The image bytes are kept in Laravel's private temporary storage only until approval; the database stores the OneDrive item ID and URL.

## Environment variables

Add these to the server's `.env` file. Do not commit the client secret.

```dotenv
ONEDRIVE_TENANT_ID=your-tenant-id
ONEDRIVE_CLIENT_ID=your-app-registration-client-id
ONEDRIVE_CLIENT_SECRET=your-client-secret
ONEDRIVE_USER_ID=onedrive-owner-user-id-or-email
ONEDRIVE_FOLDER_PATH=TCC Purrtal/Asset Photos
```

`ONEDRIVE_FOLDER_PATH` is relative to the configured user's OneDrive root. The Graph upload creates the file as `<asset_tag>.<extension>`; the same asset tag will replace an existing file with that name.

## Microsoft Entra ID / Graph permissions

Register an app in Microsoft Entra ID, create a client secret, and grant the application permission `Files.ReadWrite.All` in Microsoft Graph. An administrator must grant consent. Restrict the app further with an application access policy if the organization's Microsoft 365 security policy requires it.

After changing `.env`, run `php artisan config:clear` (or restart the application) so Laravel reloads the values.

## Mobile capture

The capture page uses a native file input with `accept="image/*"` and `capture="environment"`. On supported phones, tapping it opens the rear camera and the browser asks for permission. A file-picker fallback remains available.

For reliable access from a phone on the office Wi-Fi, serve the site over HTTPS with a certificate trusted by the phone. Browsers restrict camera features on ordinary non-localhost HTTP pages.
