CLI to run when cloning a new copy to a machine.

COPY OR CREATE A NEW .env FILE TO THE ROOT FOLDER OF THE CLONE

To create a new .env file, create a new text file and rename it as ".env"

If creating a new .env file copy paste this on the file: 
***************************************************************
APP_NAME=TCCPurrtal
APP_ENV=local
APP_KEY=base64:yDnb9PS06Yfn4bUZIn4ro+kg03xNfgWCzHWblcdvJoU=
APP_DEBUG=true
APP_URL=http://localhost:8000

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
# APP_MAINTENANCE_STORE=database

# PHP_CLI_SERVER_WORKERS=4

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=tccportal
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database
# CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

QUEUE_CONNECTION=sync

MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=5611b0102a6b35
MAIL_PASSWORD=3aa7a96a09de94
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="admin@catclinic.local"
MAIL_FROM_NAME="The Cat Clinic Admin"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"
***************************************************************

CLI TO RUN (in order)
***************************************************************
composer update -W --ignore-platform-req=php

npm install

npm run build
***************************************************************

If a "maatwebsite" error is encountered, do the following.

1. Go to the php folder of your device (normally inside C:).
2. Open the php.ini file.
3. Press Crtl+F then type "extension=gd"
4. remove the semicolon (;)
5. Run the composer update again

If an "+ CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException + FullyQualifiedErrorId : RedirectionNotSupported" error occured, run this command:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser