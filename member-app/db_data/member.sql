CREATE DATABASE member CHARACTER SET utf8 COLLATE utf8_general_ci;
USE member;
CREATE TABLE users (
	id int(10) NOT NULL PRIMARY KEY AUTO_INCREMENT,
	fname varchar(50) NOT NULL,
	lname varchar(50) NOT NULL,
	username varchar(50) NOT NULL UNIQUE KEY,
	password varchar(255) NOT NULL,
	old_pass1 varchar(255),
	old_pass2 varchar(255),
	old_pass3 varchar(255),
	old_pass4 varchar(255),
	old_pass5 varchar(255),
	pic_name varchar(255),
	profile_pic LONGBLOB
) ENGINE=InnoDB DEFAULT CHARSET=utf8;