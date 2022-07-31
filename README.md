# telegram-bot-notes

A telegram bot designed to help remember everything that's so important, link any topic with notes and organize your tasks in one place.

## Screenshots
<p float="left">
  <img src="https://user-images.githubusercontent.com/59533626/182002772-60b089d0-42b3-4da4-963f-1b6b878afd7f.png" height="600" width="300">
  <img src="https://user-images.githubusercontent.com/59533626/182002777-7bdd20b4-39c9-4fc6-9ebd-3eb31fe3d3b1.png" height="600" width="300">
  <img src="https://user-images.githubusercontent.com/59533626/182002780-9af4dab3-2bf5-4d1c-bb2b-decd387904f3.png" height="600" width="300">
</p>

## Features

- :heavy_check_mark: Do everything on time. Create and assign your homework with due dates so nothing falls through the cracks.
- :busts_in_silhouette: Work with your group. Share, update, create your group homework and view them together to get your homework done in time.
- :closed_lock_with_key: Stay encrypted. Keep all your notes, homework encrypted, so privacy isn’t an optional mode.
- :earth_africa: Multilingual. Telegram bot supports 4 languages, but this list can be expanded as you wish.

## Requirements

1. Installed Linux, Apache, MySQL, PHP (LAMP) stack on your local machine or remote server.
2. Telegram bot account.

### LAMP stack installiation

If you already have a LAMP stack installed, you can skip this step. Otherwise, complete the LAMP stack installation on your target machine or follow this [tutorial](https://www.digitalocean.com/community/tutorials/how-to-install-linux-apache-mysql-php-lamp-stack-on-ubuntu-20-04).

### Telegram token

To use the [Telegram Bot API](https://core.telegram.org/bots/api), you first have to [get a bot account](https://core.telegram.org/bots) by [chatting with BotFather](https://core.telegram.org/bots#6-botfather).
BotFather will give you a token, something like 123456789:AbCdfGhIJKlmNoQQRsTUVwxyZ.

## Getting started

### Installation

* Clone the project

```bash
  git clone https://github.com/ArtemBurakov/telegram-bot-notes.git
```

* Go to the project directory

```bash
  cd telegram-bot-notes
```

* Install dependencies

```bash
  npm install
```

* Start the bot (before starting follow the configuration steps)

```bash
  node bot.js
```

## Configuration

### Create Database

* Go to the db folder located in src folder

```bash
  cd src/db
```

* Execute `create-db.sql` file

Replace `YOUR_DB_USER_NAME` with your MySQL user name. After running this command, you will be prompted for the MySQL user password.

```bash
  mysql -u YOUR_DB_USER_NAME -p < create-db.sql
```

Now a new database for this project has been created. You can check it by using [PhpMyAdmin](https://www.phpmyadmin.net/).

### Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file.

* Create a new `.env` file in project root folder

```bash
  touch .env
```

#### Configuration Values

* `DB_HOST` - your database host, such as localhost
* `DB_USER` - MySQL user name
* `DB_PASS` - MySQL user password
* `DB_DATABASE` - database name. If you followed the steps above, it will `telegram_bot_notes`
* `SECRET_TOKEN` - secret token used to encrypt user data. Just pick a random string
* `TELEGRAM_TOKEN` - telegram bot token given by [BotFather](https://core.telegram.org/bots#6-botfather)

#### `.env` file example:

```
DB_HOST=localhost
DB_USER=YOUR_DB_USER_NAME
DB_PASS=YOUR_DB_USER_PASSWORD
DB_DATABASE=telegram_bot_notes
SECRET_TOKEN=E-ybrW[TD>37:.JtR24#%K'HG;X<g3CaxZ6}{VgflyscvPhj
TELEGRAM_TOKEN=123456789:AbCdfGhIJKlmNoQQRsTUVwxyZ
```

## Create telegram-bot-notes service to run server as background service

* Get path to node binary

```bash
  which node
  #/usr/bin/node
```

* Create service unit file

```bash
sudo systemctl edit telegram-bot-notes.service --force --full
```

* Paste next content there:

```bash
[Unit]
Description=TelegramBotNotes

[Service]
ExecStart=/usr/bin/node /path/to/project/telegram-bot-notes/bot.js
Restart=always
#User=username
#Group=nogroup
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
WorkingDirectory=/path/to/project/telegram-bot-notes

[Install]
WantedBy=multi-user.target
```

Then save unit file (ctrl+x then Y then Enter).

* Check unit file content

```bash
sudo systemctl cat telegram-bot-notes
```

* Reload the systemd daemon

```bash
sudo systemctl daemon-reload
```

* Enable service at boot

```bash
sudo systemctl enable telegram-bot-notes
```

### Start service

```bash
sudo systemctl start telegram-bot-notes
```

* To check service status

```
sudo systemctl status telegram-bot-notes
```

After running this command, you can see the status of the service. Note that it must be active (running).

```
telegram-bot-notes.service - TelegramBotNotes
     Loaded: loaded (/etc/systemd/system/telegram-bot-notes.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2022-07-31 16:34:11 EEST; 3s ago
   Main PID: 13446 (node)
      Tasks: 11 (limit: 19016)
     Memory: 28.0M
     CGroup: /system.slice/telegram-bot-notes.service
             └─13446 /usr/bin/node /home/artem/Projects/notes/bot.js
```

* To check service logs

```bash
journalctl -u telegram-bot-notes
```

* To check opened ports (8443, 9443)

```bash
netstat -tulpn
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.