const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();

// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Xuhan014',
    database: 'c237_016_t4ca2',
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }

    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(express.urlencoded({
    extended: false
}));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(flash());

// Check whether user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash(
            'error',
            'Please log in to view this resource'
        );

        res.redirect('/login');
    }
};

// Check whether user is an admin
const checkAdmin = (req, res, next) => {
    if (
        req.session.user.role === 'Admin' ||
        req.session.user.role === 'admin'
    ) {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Check whether user is a patient
const checkPatient = (req, res, next) => {
    if (
        req.session.user.role === 'Patient' ||
        req.session.user.role === 'patient'
    ) {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Check whether user is pharmacy staff
const checkStaff = (req, res, next) => {
    if (
        req.session.user.role === 'Pharmacy Staff' ||
        req.session.user.role === 'Staff' ||
        req.session.user.role === 'staff'
    ) {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Check whether user is patient or pharmacy staff
const checkPatientOrStaff = (req, res, next) => {
    if (
        req.session.user.role === 'Patient' ||
        req.session.user.role === 'patient' ||
        req.session.user.role === 'Pharmacy Staff' ||
        req.session.user.role === 'Staff' ||
        req.session.user.role === 'staff'
    ) {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Home page
app.get('/', (req, res) => {
    res.render('index', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

// Registration page
app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

// Validate registration
const validateRegistration = (req, res, next) => {
    const {
        username,
        email,
        password,
        address,
        contact
    } = req.body;

    if (
        !username ||
        !email ||
        !password ||
        !address ||
        !contact
    ) {
        req.flash(
            'error',
            'All fields are required.'
        );

        req.flash('formData', req.body);

        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash(
            'error',
            'Password should be at least 6 or more characters long'
        );

        req.flash('formData', req.body);

        return res.redirect('/register');
    }

    next();
};

// Submit registration
// Public registration always creates a Patient account
app.post(
    '/register',
    validateRegistration,
    (req, res) => {
        const {
            username,
            email,
            password,
            address,
            contact
        } = req.body;

        const role = 'Patient';

        const sql = `
            INSERT INTO users
            (
                username,
                email,
                password,
                address,
                contact,
                role
            )
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;

        db.query(
            sql,
            [
                username,
                email,
                password,
                address,
                contact,
                role
            ],
            (err, result) => {
                if (err) {
                    console.log(err);
                    return res.send('Database Error');
                }

                console.log(result);

                req.flash(
                    'success',
                    'Registration successful! Please log in.'
                );

                res.redirect('/login');
            }
        );
    }
);

// Login page
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// Submit login
app.post('/login', (req, res) => {
    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        req.flash(
            'error',
            'All fields are required.'
        );

        return res.redirect('/login');
    }

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
        AND password = SHA1(?)
    `;

    db.query(
        sql,
        [email, password],
        (err, results) => {
            if (err) {
                console.log(err);
                return res.send('Database Error');
            }

            if (results.length > 0) {
                req.session.user = results[0];

                req.flash(
                    'success',
                    'Login successful!'
                );

                if (
                    req.session.user.role === 'Admin' ||
                    req.session.user.role === 'admin'
                ) {
                    res.redirect('/admin');
                } else {
                    res.redirect('/dashboard');
                }
            } else {
                req.flash(
                    'error',
                    'Invalid email or password.'
                );

                res.redirect('/login');
            }
        }
    );
});

// User dashboard
app.get(
    '/dashboard',
    checkAuthenticated,
    (req, res) => {
        if (
            req.session.user.role === 'Admin' ||
            req.session.user.role === 'admin'
        ) {
            return res.redirect('/admin');
        }

        res.render('dashboard', {
            user: req.session.user,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    }
);

// Admin page
app.get(
    '/admin',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        res.render('admin', {
            user: req.session.user,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    }
);

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }

        res.redirect('/');
    });
});

// Display Add Medication page
app.get(
    '/addMedication',
    checkAuthenticated,
    checkPatientOrStaff,
    (req, res) => {
        res.render('addMedication', {
            user: req.session.user
        });
    }
);

// Display Add Appointment page
app.get(
    '/addAppointment',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        res.render('addAppointment', {
            user: req.session.user
        });
    }
);

// Display Add Staff page
app.get(
    '/addStaff',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        res.render('addStaff', {
            user: req.session.user
        });
    }
);

// Add medication
// Add medication
app.post(
    '/addMedication',
    checkAuthenticated,
    checkPatientOrStaff,
    (req, res) => {
        const {
            medicationName,
            dosage,
            frequency,
            startDate,
            endDate,
            notes
        } = req.body;

        const userId = req.session.user.id;
        const role = req.session.user.role;

        let medicationType = 'Personal';

        if (
            role === 'Pharmacy Staff' ||
            role === 'Staff' ||
            role === 'staff'
        ) {
            medicationType = 'Pharmacy';
        }

        let finalEndDate = endDate;

        if (!endDate) {
            finalEndDate = null;
        }

        const sql = `
            INSERT INTO medications
            (
                userId,
                medicationName,
                dosage,
                frequency,
                startDate,
                endDate,
                notes,
                medicationType
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                userId,
                medicationName,
                dosage,
                frequency,
                startDate,
                finalEndDate,
                notes,
                medicationType
            ],
            (err) => {
                if (err) {
                    console.log(err);

                    return res.send(
                        'Error adding medication'
                    );
                }

                req.flash(
                    'success',
                    'Medication added successfully!'
                );

                res.redirect('/medications');
            }
        );
    }
);

// Add appointment
app.post(
    '/addAppointment',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        /*
            Form field names:

            clinicName
            reason
            doctorName
            appointmentDate
            appointmentTime
            notes
        */

        const {
            clinicName,
            reason,
            doctorName,
            appointmentDate,
            appointmentTime,
            notes
        } = req.body;

        const userId = req.session.user.id;

        // Store the reason and notes together
        // inside the existing additionalNotes column
        let additionalNotes = reason;

        if (notes) {
            additionalNotes =
                additionalNotes +
                ' - ' +
                notes;
        }

        const sql = `
            INSERT INTO appointments
            (
                userId,
                clinicHospital,
                preferredDoctor,
                appointmentDate,
                appointmentTime,
                additionalNotes
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                userId,
                clinicName,
                doctorName,
                appointmentDate,
                appointmentTime,
                additionalNotes
            ],
            (err) => {
                if (err) {
                    console.log(err);

                    return res.send(
                        'Error booking appointment'
                    );
                }

                req.flash(
                    'success',
                    'Appointment booked successfully!'
                );

                res.redirect('/dashboard');
            }
        );
    }
);

// Admin adds pharmacy staff
app.post(
    '/addStaff',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const {
            clinicName,
            staffId,
            fullName,
            phone,
            email,
            password
        } = req.body;

        if (
            !clinicName ||
            !staffId ||
            !fullName ||
            !phone ||
            !email ||
            !password
        ) {
            return res.send(
                'All fields are required.'
            );
        }

        /*
            The existing users table does not have
            clinicName or staffId columns.

            Store them in the address column instead.
        */

        const address =
            clinicName +
            ' - Staff ID: ' +
            staffId;

        const role = 'Pharmacy Staff';

        const sql = `
            INSERT INTO users
            (
                username,
                email,
                password,
                address,
                contact,
                role
            )
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;

        db.query(
            sql,
            [
                fullName,
                email,
                password,
                address,
                phone,
                role
            ],
            (err) => {
                if (err) {
                    console.log(err);

                    return res.send(
                        'Error adding staff'
                    );
                }

                req.flash(
                    'success',
                    'Pharmacy staff added successfully!'
                );

                res.redirect('/admin');
            }
        );
    }
);

// View patient's appointments
app.get(
    '/appointments',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const userId = req.session.user.id;

        const sql = `
            SELECT
                appointmentId,
                clinicHospital,
                preferredDoctor,
                DATE_FORMAT(
                    appointmentDate,
                    '%Y-%m-%d'
                ) AS appointmentDate,
                appointmentTime,
                additionalNotes
            FROM appointments
            WHERE userId = ?
            ORDER BY
                appointmentDate DESC,
                appointmentTime DESC
        `;

        db.query(
            sql,
            [userId],
            (err, results) => {
                if (err) {
                    console.log(err);

                    return res.send(
                        'Error retrieving appointments'
                    );
                }

                res.render('appointments', {
                    user: req.session.user,
                    appointments: results,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            }
        );
    }
);

// View and search medications
app.get(
    '/medications',
    checkAuthenticated,
    checkPatientOrStaff,
    (req, res) => {
        const userId = req.session.user.id;
        const role = req.session.user.role;

        const search = req.query.search || '';
        const frequency = req.query.frequency || '';
        const sort = req.query.sort || 'name';

        let medicationType = 'Personal';

        if (
            role === 'Pharmacy Staff' ||
            role === 'Staff' ||
            role === 'staff'
        ) {
            medicationType = 'Pharmacy';
        }

        let orderBy = 'medicationName ASC';

        if (sort === 'date') {
            orderBy = 'startDate DESC';
        }

        const sql = `
            SELECT
                medicationId,
                medicationName,
                dosage,
                frequency,
                DATE_FORMAT(
                    startDate,
                    '%Y-%m-%d'
                ) AS startDate,
                DATE_FORMAT(
                    endDate,
                    '%Y-%m-%d'
                ) AS endDate,
                notes,
                medicationType
            FROM medications
            WHERE medicationType = ?
            AND medicationName LIKE ?
            AND frequency LIKE ?
            ${medicationType === 'Personal'
                ? 'AND userId = ?'
                : ''
            }
            ORDER BY ${orderBy}
        `;

        let values = [
            medicationType,
            '%' + search + '%',
            '%' + frequency + '%'
        ];

        if (medicationType === 'Personal') {
            values.push(userId);
        }

        db.query(
            sql,
            values,
            (err, results) => {
                if (err) {
                    console.log(err);

                    return res.send(
                        'Error retrieving medications'
                    );
                }

                res.render('medications', {
                    user: req.session.user,
                    medications: results,
                    search: search,
                    frequency: frequency,
                    sort: sort,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            }
        );
    }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );
});