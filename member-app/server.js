const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');

const alreadyLogIn = false;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload());

// set view
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// cookie
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000 // 1hr
}));

global.__basedir = __dirname;

// custom middleware
const ifNotLoggedin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.render('home', {
            name: null,
            alreadyLogIn: false
        });
    }
    next();
}
const ifLoggedin = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/');
    }
    next();
}

// password validate sequential
function password_validate(s) {
    // Check for sequential numerical characters
    for (var i in s)
        if (+s[+i + 1] == +s[i] + 1 &&
            +s[+i + 2] == +s[i] + 2) return false;
    // Check for sequential alphabetical characters
    for (var i in s)
        if (String.fromCharCode(s.charCodeAt(i) + 1) == s[+i + 1] &&
            String.fromCharCode(s.charCodeAt(i) + 2) == s[+i + 2]) return false;
    return true;
}
// // end of custom middleware

const isImage = (file) => {
    return file.mimetype == "image/jpeg" || file.mimetype == "image/png" || file.mimetype == "image/gif"
}

// home page
app.get('/', ifNotLoggedin, (req, res, next) => {
    dbConnection.execute("SELECT concat(`fname`, ' ' , `lname`) as `name`, `profile_pic` FROM `users` WHERE `id`=?", [req.session.userID])
        .then(([rows]) => {
            res.render('home', {
                name: rows[0].name,
                data: rows[0].profile_pic.toString('base64'),
                alreadyLogIn: true
            });
        }).catch(err => {
            if (err) throw err;
        });
});
// end of home page

// register page
app.get('/register', (req, res) => {
    if (req.session.isLoggedIn) {
        res.redirect('/');
    }
    else {
        res.render('register', {
            alreadyLogIn: false
        });
    }
});

app.post('/register', ifLoggedin,
    // post data validation(using express-validator)
    [
        body('user_username', 'Total 12 characters and numbers with _ are allowed')
            .isLength({ max: 12 })
            .matches(/^[a-zA-Z0-9_]*$/),
        body('user_username').notEmpty().custom((value) => {
            return dbConnection.execute('SELECT `username` FROM `users` WHERE `username`=?', [value])
                .then(([rows]) => {
                    if (rows.length > 0) {
                        return Promise.reject('This Username already in use!');
                    }
                    return true;
                });
        }),
        body('user_fname', 'First Name is empty!').trim().notEmpty(),
        body('user_lname', 'Last Name is empty!').trim().notEmpty(),
        body('user_pass', 'The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
        body('user_pass').custom((value) => {
            if (password_validate(value)) {
                return true
            }
            return Promise.reject('The password must not 3 sequential characters (ex. abc, 123)');
        }),
    ],// end of post data validation
    (req, res, next) => {
        var validation_result = validationResult(req);
        const { user_fname, user_lname, user_pass, user_username } = req.body;
        // if file and img tpye
        var isImg = false;
        if (req.files) {
            if (isImage(req.files.file)) {
                isImg = true;
            }
        }
        if (validation_result.isEmpty() && isImg) {
            var imageBuffer = req.files.file.data;
            var imageName = req.files.file.name;;
            // password encryption (using bcryptjs)
            bcrypt.hash(user_pass, 12).then((hash_pass) => {
                // INSERTING USER INTO DATABASE
                dbConnection.execute("INSERT INTO `users`(`fname`, `lname`,`username`,`password`, `pic_name`, `profile_pic`) VALUES (?, ?, ?, ?, ?, ?)", [user_fname, user_lname, user_username, hash_pass, imageName, imageBuffer])
                    .then(result => {
                        res.send(`your account has been created successfully, Now you can <a href="/login">Login</a>`);
                        // res.redirect('/');
                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        if (err) throw err;
                    });
            })
                .catch(err => {
                    // THROW HASING ERROR'S
                    if (err) throw err;
                })
        }
        else {
            // COLLECT ALL THE VALIDATION ERRORS
            let allErrors = validation_result.errors.map((error) => {
                return error.msg;
            });

            if (!req.files) {
                allErrors.unshift('No File selected!');
            } else if (!isImg) {
                allErrors.push('Selected file is not png, gif or jpeg type!');
            }

            // REDERING login PAGE WITH VALIDATION ERRORS
            res.render('register', {
                alreadyLogIn: alreadyLogIn,
                register_error: allErrors,
                old_data: req.body
            });
        }
    });
// end of register page

// profile page
app.get('/profile', (req, res, next) => {
    if (req.session.isLoggedIn) {
        dbConnection.execute("SELECT `fname`, `lname`, `username`, `profile_pic` FROM `users` WHERE `id`=?", [req.session.userID])
            .then(([rows]) => {
                res.render('profile', {
                    user_fname: rows[0].fname,
                    user_lname: rows[0].lname,
                    user_username: rows[0].username,
                    name: rows[0].fname + ' ' + rows[0].lname,
                    data: rows[0].profile_pic.toString('base64'),
                    alreadyLogIn: true,
                });
            });
    }
    else {
        res.redirect('/');
    }
});

app.post('/profile',
    // post data validation(using express-validator)
    [
        body('user_fname').custom((value, { req }) => {
            if (req.body.submit === 'save' && value.trim() === '') {
                return Promise.reject('First Name is empty!');
            }
            return true
        }),
        body('user_lname').custom((value, { req }) => {
            if (req.body.submit === 'save' && value.trim() === '') {
                return Promise.reject('Last Name is empty!');
            }
            return true
        }),

        body('user_pass').custom((value, { req }) => {
            if (req.body.submit === 'change' && value.trim() === '') {
                return Promise.reject('Password is empty!');
            }
            return true
        }),

        body('user_newpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && value.trim() === '') {
                return Promise.reject('New Password is empty!');
            }
            return true
        }),
        body('user_cnewpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && value.trim() === '') {
                return Promise.reject('Confirm New password is empty!');
            }
            return true
        }),

        body('user_newpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && value.trim().length < 6) {
                return Promise.reject('New password must be of minimum length 6 characters');
            }
            return true
        }),
        body('user_newpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && !password_validate(value)) {
                return Promise.reject('New password must not 3 sequential characters (ex. abc, 123)');
            }
            return true
        }),

        body('user_cnewpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && value.trim().length < 6) {
                return Promise.reject('Confirm New password must be of minimum length 6 characters');
            }
            return true
        }),
        body('user_cnewpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && !password_validate(value)) {
                return Promise.reject('Confirm New password must not 3 sequential characters (ex. abc, 123)');
            }
            return true
        }),

        body('user_cnewpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && req.body.user_newpass !== value) {
                return Promise.reject('New Password and Confirm New Password must be the same');
            }
            return true
        }),

        body('user_newpass').custom((value, { req }) => {
            if (req.body.submit === 'change' && req.body.user_pass === value) {
                return Promise.reject('Old Password and New Password must not be the same');
            }
            return true
        }),
    ],// end of post data validation
    (req, res, next) => {
        // init validation_result
        const validation_result = validationResult(req);
        // profile pic change
        if (req.body.submit === 'save_pic') {
            // if file upload
            var isImg = false;
            if (req.files) {
                if (isImage(req.files.file)) {
                    isImg = true;
                }
            }
            if (validation_result.isEmpty() && isImg) {

                var imageBuffer = req.files.file.data;
                var imageName = req.files.file.name;

                // update user into database
                dbConnection.execute("UPDATE `users` SET `pic_name` = ?, `profile_pic` = ? WHERE `id` = ?", [imageName, imageBuffer, req.session.userID])
                    .then(result => {
                        dbConnection.execute("SELECT * FROM `users` WHERE `id`= ?", [req.session.userID]).then(([rows]) => {
                            res.render('profile', {
                                user_fname: rows[0].fname,
                                user_lname: rows[0].lname,
                                user_username: rows[0].username,
                                name: rows[0].fname + ' ' + rows[0].lname,
                                data: rows[0].profile_pic.toString('base64'),
                                alreadyLogIn: true,
                                profile_msg: true
                            });
                        });
                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        if (err) throw err;
                    });
            } else {
                let allErrors = validation_result.errors.map((error) => {
                    return error.msg;
                });

                if (!req.files) {
                    allErrors.unshift('No File selected!');
                } else if (!isImg) {
                    allErrors.push('Selected file is not png, gif or jpeg type!');
                }

                // REDERING profile PAGE WITH VALIDATION ERRORS
                dbConnection.execute("SELECT fname, lname, username, profile_pic FROM `users` WHERE `id`=?", [req.session.userID])
                    .then(([rows]) => {
                        var fname = { 'user_fname': rows[0].fname };
                        var lname = { 'user_lname': rows[0].lname };
                        var username = { 'user_username': rows[0].username };

                        var old_obj = Object.assign(req.body, fname, lname, username);
                        res.render('profile', {
                            name: rows[0].fname + ' ' + rows[0].lname,
                            alreadyLogIn: true,
                            pic_errors: allErrors,
                            data: rows[0].profile_pic.toString('base64'),
                            old_data: old_obj,
                        });
                    });
            }
        }
        // save name
        if (req.body.submit === 'save') {

            const { user_fname, user_lname, user_username } = req.body;

            // IF validation_result HAS NO ERROR
            if (validation_result.isEmpty()) {
                // update user into database
                dbConnection.execute("UPDATE `users` SET `fname` = ?, `lname` = ? WHERE `username` = ?", [user_fname, user_lname, user_username])
                    .then(result => {
                        dbConnection.execute("SELECT concat(`fname`, ' ' , `lname`) as `name`, `profile_pic` FROM `users` WHERE `id`=?", [req.session.userID])
                            .then(([rows]) => {
                                res.render('profile', {
                                    user_fname: user_fname,
                                    user_lname: user_lname,
                                    user_username: user_username,
                                    name: user_fname + ' ' + user_lname,
                                    data: rows[0].profile_pic.toString('base64'),
                                    alreadyLogIn: true,
                                    profile_msg: true
                                });
                            });

                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        if (err) throw err;
                    });
            }
            else {
                // COLLECT ALL THE VALIDATION ERRORS
                let allErrors = validation_result.errors.map((error) => {
                    return error.msg;
                });
                // rendering profile page with validation errors
                dbConnection.execute("SELECT concat(`fname`, ' ' , `lname`) as `name`, `profile_pic` FROM `users` WHERE `id`=?", [req.session.userID])
                    .then(([rows]) => {
                        res.render('profile', {
                            name: rows[0].name,
                            alreadyLogIn: true,
                            profile_errors: allErrors,
                            data: rows[0].profile_pic.toString('base64'),
                            old_data: req.body,
                        });
                    });

            }
        }
        // change password
        if (req.body.submit === 'change') {

            const { user_pass, user_newpass, user_cnewpass } = req.body;

            // IF validation_result HAS NO ERROR
            if (validation_result.isEmpty()) {

                dbConnection.execute("SELECT * FROM `users` WHERE `id`= ?", [req.session.userID])
                    .then(([rows]) => {
                        // validate old password
                        bcrypt.compare(user_pass, rows[0].password).then(compare_result => {

                            var fname = { 'user_fname': rows[0].fname };
                            var lname = { 'user_lname': rows[0].lname };
                            var username = { 'user_username': rows[0].username };

                            var old_obj = Object.assign(req.body, fname, lname, username);

                            const op1 = rows[0].old_pass1;
                            const op2 = rows[0].old_pass2;
                            const op3 = rows[0].old_pass3;
                            const op4 = rows[0].old_pass4;
                            const op5 = rows[0].old_pass5;

                            if (compare_result === true) {
                                // declare for validate password change
                                bcrypt.hash(user_newpass, 12).then(hash => {

                                    (async () => {
                                        // compare all old password
                                        const result1 = await bcrypt.compare(user_newpass, op1 ? op1 : '');
                                        const result2 = await bcrypt.compare(user_newpass, op2 ? op2 : '');
                                        const result3 = await bcrypt.compare(user_newpass, op3 ? op3 : '');
                                        const result4 = await bcrypt.compare(user_newpass, op4 ? op4 : '');
                                        const result5 = await bcrypt.compare(user_newpass, op5 ? op5 : '');

                                        if (result1 || result2 || result3 || result4 || result5) {
                                            res.render('profile', {
                                                name: rows[0].fname + ' ' + rows[0].lname,
                                                old_data: old_obj,
                                                alreadyLogIn: true,
                                                data: rows[0].profile_pic.toString('base64'),
                                                password_errors: ['This password has been used recently!'],
                                            });
                                        } else {
                                            // console.log("password validated!");
                                            dbConnection.execute("UPDATE users SET password = ?, old_pass1 = ?, old_pass2 = ?, old_pass3 = ?, old_pass4 = ?, old_pass5 = ? WHERE id = ?",
                                                [hash, rows[0].password, rows[0].old_pass1, rows[0].old_pass2, rows[0].old_pass3, rows[0].old_pass4, req.session.userID])
                                                .then(result => {
                                                    req.session.isLoggedIn = false;
                                                    req.session = null;
                                                    res.send(`your password has been changed successfully, please <a href="/login">Login</a> again`);
                                                    // res.redirect('/');
                                                });
                                        }
                                    })();
                                }).catch(err => {
                                    if (err) throw err;
                                });
                            }
                            else {
                                // render profile page again with error
                                res.render('profile', {
                                    name: rows[0].fname + ' ' + rows[0].lname,
                                    old_data: old_obj,
                                    alreadyLogIn: alreadyLogIn,
                                    data: rows[0].profile_pic.toString('base64'),
                                    password_errors: ['Invalid Old Password!']
                                });
                            }
                        }).catch(err => {
                            if (err) throw err;
                        });
                    }).catch(err => {
                        if (err) throw err;
                    });
            }
            else {
                // COLLECT ALL THE VALIDATION ERRORS
                let allErrors = validation_result.errors.map((error) => {
                    return error.msg;
                });
                // rendering profile page with validation errors
                dbConnection.execute("SELECT `fname`, `lname`, `username`, `profile_pic` FROM `users` WHERE `id`=?", [req.session.userID])
                    .then(([rows]) => {

                        var fname = { 'user_fname': rows[0].fname };
                        var lname = { 'user_lname': rows[0].lname };
                        var username = { 'user_username': rows[0].username };

                        var old_obj = Object.assign(req.body, fname, lname, username);

                        res.render('profile', {
                            name: rows[0].fname + ' ' + rows[0].lname,
                            alreadyLogIn: true,
                            data: rows[0].profile_pic.toString('base64'),
                            password_errors: allErrors,
                            old_data: old_obj,
                        });
                    });

            }
        }
    });
// end of profile page

// login page
app.get('/login', (req, res) => {
    if (req.session.isLoggedIn) {
        res.redirect('/');
    }
    else {
        res.render('login', {
            alreadyLogIn: false
        });
    }
});

app.post('/login', ifLoggedin, [
    body('user_username').custom((value) => {
        return dbConnection.execute('SELECT username FROM users WHERE username=?', [value])
            .then(([rows]) => {
                if (rows.length == 1) {
                    return true;
                }
                return Promise.reject('Invalid Username!');

            });
    }),
    body('user_pass', 'Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_username } = req.body;
    if (validation_result.isEmpty()) {

        dbConnection.execute("SELECT * FROM `users` WHERE `username`= ?", [user_username])
            .then(([rows]) => {
                bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                    if (compare_result === true) {
                        req.session.isLoggedIn = true;
                        req.session.userID = rows[0].id;

                        res.redirect('/');
                    }
                    else {
                        res.render('login', {
                            alreadyLogIn: alreadyLogIn,
                            login_errors: ['Invalid Password!']
                        });
                    }
                })
                    .catch(err => {
                        if (err) throw err;
                    });


            }).catch(err => {
                if (err) throw err;
            });
    }
    else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // redering login page with login validation errors
        res.render('login', {
            alreadyLogIn: alreadyLogIn,
            login_errors: allErrors
        });
    }
});
// end of login page

// logout
app.get('/logout', (req, res) => {
    //session destroy
    req.session = null;
    res.redirect('/');
});
// end of logout

app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1><a href="/">Home</a>');
});

var port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Running at localhost:${port}`);
});