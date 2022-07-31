DROP DATABASE IF EXISTS telegram_bot_notes;
CREATE DATABASE IF NOT EXISTS telegram_bot_notes;
USE telegram_bot_notes;

DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users
  (
     id           INT PRIMARY KEY auto_increment,
     first_name   VARCHAR(100),
     user_id      INT UNIQUE NOT NULL,
     role         ENUM('Admin', 'SuperUser') DEFAULT 'SuperUser'
  );

DROP TABLE IF EXISTS hometasks;

CREATE TABLE IF NOT EXISTS hometasks
  (
     id           INT PRIMARY KEY auto_increment,
     user_id      INT NOT NULL,
     name         LONGTEXT NOT NULL,
     text         LONGTEXT NOT NULL,
     status       INT NOT NULL DEFAULT 10,
     priority     INT NOT NULL DEFAULT 10,
     created_at   INT NOT NULL,
     updated_at   INT NOT NULL,
     deadline_at  INT NOT NULL
  );

DROP TABLE IF EXISTS notes;

CREATE TABLE IF NOT EXISTS notes
  (
     id           INT PRIMARY KEY auto_increment,
     user_id      INT NOT NULL,
     name         LONGTEXT NOT NULL,
     text         LONGTEXT NOT NULL,
     status       INT NOT NULL DEFAULT 10,
     priority     INT NOT NULL DEFAULT 10,
     created_at   INT NOT NULL,
     updated_at   INT NOT NULL,
     deadline_at  INT NOT NULL
  );