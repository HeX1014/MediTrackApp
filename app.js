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

        const userId = req.session.user.id;
        
        const sql = `
            SELECT deleteRequest
            FROM users
            WHERE id = ?
        `;

        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.log(err);
                return res.send('Error loading dashboard');
            }

            res.render('dashboard', {
                user: req.session.user,
                hasPendingDeletionRequest: results.length > 0 && results[0].deleteRequest === 1,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    }
);

// Admin page
app.get(
    '/admin',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const usersSql = `
            SELECT id, username, email, role
            FROM users
            ORDER BY role, username
        `;

        db.query(usersSql, (err, userResults) => {
            if (err) {
                console.log(err);
                return res.send('Error retrieving user list');
            }

            const requestsSql = `
                SELECT id, username, email, role
                FROM users
                WHERE deleteRequest = 1
                ORDER BY username ASC
            `;

            db.query(requestsSql, (err2, requestResults) => {
                if (err2) {
                    console.log(err2);
                    return res.send('Error retrieving deletion requests');
                }

                res.render('admin', {
                    user: req.session.user,
                    users: userResults,
                    deletionRequests: requestResults,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            });
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
        db.query(
            'SELECT * FROM medications',
            (err, results) => {
                res.render('addMedication', {
                    user: req.session.user,
                    medications: results
                });
            }
        );
    }
);

// Display Add Medication page for pharmacy staff
app.get(
    '/addMedsForStaff',
    checkAuthenticated,
    checkStaff,
    (req, res) => {
        res.render('addMedsForStaff', {
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
app.post(
    '/addMedication',
    checkAuthenticated,
    checkPatientOrStaff,
    (req, res) => {
        let { endDate } = req.body;
        const {
            medicationId,
            dosage,
            frequency,
            startDate,
            notes
        } = req.body;

        const userId = req.session.user.id;
        const role = req.session.user.role;

        const sql = `
            INSERT INTO medication_for_patient
            (
                id,
                medicationId,
                dosage,
                frequency,
                startDate,
                endDate,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        console.log(`Adding medication for userId: ${userId}, medicationId: ${medicationId}, dosage: ${dosage}, frequency: ${frequency}, startDate: ${startDate}, endDate: ${endDate}, notes: ${notes}`
        );

        if (endDate === '') {
            endDate = null;
        }

        db.query(
            sql,
            [
                userId,
                medicationId,
                dosage,
                frequency,
                startDate,
                endDate,
                notes
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

// Add medication for pharmacy staff
app.post(
    '/addMedsForStaff',
    checkAuthenticated,
    checkStaff,
    (req, res) => {
        const {
            medicationName,
            expDate,
            notesForStaff,
            medicationType
        } = req.body;

        const sql = `
            INSERT INTO medications
            (
                medicationName,
                expDate,
                notesForStaff,
                medicationType
            )
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                medicationName,
                expDate,
                notesForStaff,
                medicationType
            ],
            (err) => {
                if (err) {
                    console.log(err);
                    return res.send('Error adding medication');
                }

                req.flash(
                    'success',
                    'Medication added successfully!'
                );

                res.redirect('/staffMedications');
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

                res.redirect('/appointments');
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

// View and search medications for patients 
app.get(
    '/medications',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const userId = req.session.user.id;
        const role = req.session.user.role;

        const search = req.query.search || '';
        const frequency = req.query.frequency || '';
        const sort = req.query.sort || 'name';

        let medicationType = 'Personal';

        let orderBy = 'medicationName ASC';

        if (sort === 'date') {
            orderBy = 'endDate DESC';
        }

        const sql = `
            SELECT
                medication_for_patient.medication_for_patientId,
                medication_for_patient.medicationId AS medicationId,
                medication_for_patient.id AS userId,
                medicationName,
                dosage,
                frequency,
                DATE_FORMAT(startDate, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(endDate, '%Y-%m-%d') AS endDate,
                notes
            FROM medication_for_patient
            INNER JOIN medications ON medication_for_patient.medicationId = medications.medicationId
            INNER JOIN users ON medication_for_patient.id = users.id
            WHERE users.id = ?
            AND medicationName LIKE ?
            AND medication_for_patient.frequency LIKE ?
            ORDER BY ${orderBy} 
        `;

        let values = [
            userId,
            '%' + search + '%',
            '%' + frequency + '%'
        ];

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

// View and search medications for pharmacy staff
app.get(
    '/staffMedications',
    checkAuthenticated,
    checkStaff,
    (req, res) => {
        const userId = req.session.user.id;
        const role = req.session.user.role;

        const search = req.query.search || '';
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
            orderBy = 'expDate DESC';
        }

        const sql = `
            SELECT
                medicationId,
            
                medicationName,
                DATE_FORMAT(expDate, '%Y-%m-%d') AS expDate,
                notesForStaff,
                medicationType
                FROM medications
            WHERE medicationName LIKE ?
            ORDER BY ${orderBy} 
        `;

        let values = [
            '%' + search + '%',
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

                res.render('staffMedications', {
                    user: req.session.user,
                    medications: results,
                    search: search,
                    sort: sort,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            }
        );
    }
);

// Edit Your Appointments
app.get('/editAppointment/:id', (req, res) => {
    const appointmentId = req.params.id;
    const sql = 'SELECT * FROM appointments WHERE appointmentId = ?';

    db.query(sql, [appointmentId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.send('Error retrieving appointment by ID');
        }

        if (results.length > 0) {
            res.render('editAppointment', { appointment: results[0] });
        } else {
            res.send('Appointment not found');
        }
    });
});

// Send the updated Information to the server
app.post('/editAppointment/:id', (req, res) => {
    const appointmentId = req.params.id;
    const { clinicHospital, preferredDoctor, appointmentDate, appointmentTime, additionalNotes } = req.body;

    const sql = `
        UPDATE appointments
        SET clinicHospital = ?, preferredDoctor = ?, appointmentDate = ?, appointmentTime = ?, additionalNotes = ?
        WHERE appointmentId = ?
    `;

    db.query(sql, [clinicHospital, preferredDoctor, appointmentDate, appointmentTime, additionalNotes, appointmentId], (error) => {
        if (error) {
            console.error('Database update error:', error.message);
            return res.send('Error updating appointment');
        }

        req.flash('success', 'Appointment updated successfully!');
        res.redirect('/appointments');
    });
});

//Edit Medications
app.get('/patient/editMedication/:id', (req, res) => {
    const medication_for_patientId = req.params.id;
    const sql = 'SELECT * FROM medication_for_patient WHERE medication_for_patientId = ?';

    let medicationList = []; // Initialize an empty array to store medications

    db.query('SELECT * FROM medications', (error, medications) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.send('Error retrieving medications');
        }

         medicationList = medications; // Store the medications in a variable
    })


    db.query(sql, [medication_for_patientId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.send('Error retrieving medication by ID');
        }

        if (results.length > 0) {
            res.render('EditMedication', { medication_for_patient: results[0], medications: medicationList });
        } else {
            res.send('Medication not found');
        }
    });
});

// Send updated information to the server
app.post('/patient/editMedication/:id', (req, res) => {
    const medication_for_patientId = req.params.id;
    let { endDate } = req.body;
    const { medicationId, dosage, frequency, startDate, notes } = req.body;
    if (endDate === '') {
        endDate = null;
    }

    const sql = `
        UPDATE medication_for_patient
        SET medicationId = ?, dosage = ?, frequency = ?, startDate = ?, endDate = ?, notes = ?
        WHERE medication_for_patientId = ?
    `;

    db.query(sql, [medicationId, dosage, frequency, startDate, endDate, notes, medication_for_patientId], (error) => {
        if (error) {
            console.error('Database update error:', error.message);
            return res.send('Error updating medication');
        }

        req.flash('success', 'Medication updated successfully!');
        res.redirect('/medications');
    });
});

// Edit medication for pharmacy staff
app.get('/staff/editMedication/:id', (req, res) => {
    const medicationId = req.params.id;
    const sql = 'SELECT * FROM medications WHERE medicationId = ?';

    db.query(sql, [medicationId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.send('Error retrieving medication by ID');
        }

        if (results.length > 0) {
            res.render('staffEditMedication', { medication: results[0] });
        } else {
            res.send('Medication not found');
        }
    });
});

// Send updated information to the server for pharmacy staff
app.post('/staff/editMedication/:id', (req, res) => {
    const medicationId = req.params.id;
    const { medicationName, expDate, medicationType, notesForStaff } = req.body;

    const sql = `
        UPDATE medications
        SET medicationName = ?, expDate = ?, medicationType = ?, notesForStaff = ?
        WHERE medicationId = ?
    `;

    db.query(sql, [medicationName, expDate, medicationType, notesForStaff, medicationId], (error) => {
        if (error) {
            console.error('Database update error:', error.message);
            return res.send('Error updating medication');
        }

        req.flash('success', 'Medication updated successfully!');
        res.redirect('/staffMedications');
    });
});

// Admin views staff members and patients
app.get(
    '/manageUsers',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const sql = `
            SELECT id, username, email, address, contact, role
            FROM users
            WHERE role = 'Pharmacy Staff' OR role = 'Staff' OR role = 'staff'
            ORDER BY username ASC
        `;
        const staffSql = `
            SELECT id, username, email, address, contact, role
            FROM users
            WHERE role = 'Pharmacy Staff'
            ORDER BY username ASC
        `;

        db.query(staffSql, (staffErr, staffResults) => {
            if (staffErr) {
                console.log(staffErr);
                return res.send('Error retrieving pharmacy staff members');
            }

            const patientSql = `
            SELECT id, username, email, address, contact, role
            FROM users
            WHERE role = 'Patient' OR role = 'patient'
            ORDER BY username ASC
        `;

            db.query(patientSql, (patientErr, patientResults) => {
                if (patientErr) {
                    console.log(patientErr);
                    return res.send('Error retrieving patients');
                }

                res.render('manageUsers', {
                    user: req.session.user,
                    staffMembers: staffResults,
                    patients: patientResults,
                });
            }
            );
        });
    }
);

// Delete own medication (removes from medication_for_patient, not the shared catalog)
app.post(
    '/medications/:id/delete',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const medicationForPatientId = req.params.id;
        const userId = req.session.user.id;

        const sql = `
            DELETE FROM medication_for_patient
            WHERE medication_for_patientId = ?
            AND id = ?
        `;

        db.query(sql, [medicationForPatientId, userId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error deleting medication');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'Medication not found, or you do not have permission to delete it.');
            } else {
                req.flash('success', 'Medication removed from your list successfully!');
            }

            res.redirect('/medications');
        });
    }
);

// Delete own appointment
app.post(
    '/appointments/:id/delete',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const appointmentId = req.params.id;
        const userId = req.session.user.id;

        const sql = `
            DELETE FROM appointments
            WHERE appointmentId = ?
            AND userId = ?
        `;

        db.query(sql, [appointmentId, userId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error deleting appointment');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'Appointment not found, or you do not have permission to delete it.');
            } else {
                req.flash('success', 'Appointment deleted successfully!');
            }

            res.redirect('/appointments');
        });
    }
);

// Admin deletes a user account
app.post(
    '/admin/users/:id/delete',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const targetUserId = req.params.id;

        if (parseInt(targetUserId) === req.session.user.id) {
            req.flash('error', 'You cannot delete your own admin account.');
            return res.redirect('/admin');
        }

        const sql = `DELETE FROM users WHERE id = ?`;

        db.query(sql, [targetUserId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error deleting user');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'User not found.');
            } else {
                req.flash('success', 'User account deleted successfully!');
            }

            res.redirect('/admin');
        });
    }
);

// My Schedule - personalized combined view
app.get(
    '/myschedule',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const userId = req.session.user.id;

        const appointmentsSql = `
            SELECT
                appointmentId,
                clinicHospital,
                preferredDoctor,
                DATE_FORMAT(appointmentDate, '%Y-%m-%d') AS appointmentDate,
                appointmentTime,
                additionalNotes
            FROM appointments
            WHERE userId = ?
            ORDER BY appointmentDate ASC, appointmentTime ASC
        `;

        const medicationsSql = `
            SELECT
                medication_for_patient.medication_for_patientId,
                medication_for_patient.medicationId AS medicationId,
                medicationName,
                dosage,
                frequency,
                DATE_FORMAT(startDate, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(endDate, '%Y-%m-%d') AS endDate,
                notes
            FROM medication_for_patient
            INNER JOIN medications ON medication_for_patient.medicationId = medications.medicationId
            WHERE medication_for_patient.id = ?
            ORDER BY startDate DESC
        `;

        db.query(appointmentsSql, [userId], (err, appointmentResults) => {
            if (err) {
                console.log(err);
                return res.send('Error retrieving your schedule');
            }

            db.query(medicationsSql, [userId], (err2, medicationResults) => {
                if (err2) {
                    console.log(err2);
                    return res.send('Error retrieving your schedule');
                }

                res.render('myschedule', {
                    user: req.session.user,
                    appointments: appointmentResults,
                    medications: medicationResults,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            });
        });
    }
);

// Delete pharmacy stock medication (staff)
app.post(
    '/staffMedications/:id/delete',
    checkAuthenticated,
    checkStaff,
    (req, res) => {
        const medicationId = req.params.id;

        const sql = `
            DELETE FROM medications
            WHERE medicationId = ?
        `;

        db.query(sql, [medicationId], (err, result) => {
            if (err) {
                console.log(err);

                if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
                    req.flash('error', 'This medication is currently prescribed to a patient and cannot be deleted.');
                    return res.redirect('/staffMedications');
                }

                return res.send('Error deleting medication');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'Medication not found.');
            } else {
                req.flash('success', 'Medication removed from pharmacy stock successfully!');
            }

            res.redirect('/staffMedications');
        });
    }
);

// Patient submits a request to delete their own account
app.post(
    '/account/delete-request',
    checkAuthenticated,
    checkPatient,
    (req, res) => {
        const userId = req.session.user.id;

        const sql = `
            UPDATE users
            SET deleteRequest = 1
            WHERE id = ?
            AND deleteRequest = 0
        `;

        db.query(sql, [userId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error submitting request');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'You already have a pending account deletion request.');
            } else {
                req.flash('success', 'Your account deletion request has been submitted for admin review.');
            }

            res.redirect('/dashboard');
        });
    }
);

// Admin approves a deletion request - actually deletes the account
app.post(
    '/admin/deletion-requests/:id/approve',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const targetUserId = req.params.id;

        if (parseInt(targetUserId) === req.session.user.id) {
            req.flash('error', 'You cannot delete your own admin account.');
            return res.redirect('/admin');
        }

        const sql = `
            DELETE FROM users
            WHERE id = ?
            AND deleteRequest = 1
        `;

        db.query(sql, [targetUserId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error deleting account');
            }

            if (result.affectedRows === 0) {
                req.flash('error', 'Request not found or already handled.');
            } else {
                req.flash('success', 'Account deletion request approved and account removed.');
            }

            res.redirect('/admin');
        });
    }
);

// Admin rejects a deletion request - account is kept
app.post(
    '/admin/deletion-requests/:id/reject',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const targetUserId = req.params.id;

        const sql = `
            UPDATE users
            SET deleteRequest = 0
            WHERE id = ?
        `;

        db.query(sql, [targetUserId], (err, result) => {
            if (err) {
                console.log(err);
                return res.send('Error rejecting request');
            }

            req.flash('success', 'Deletion request rejected.');
            res.redirect('/admin');
        });
    }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );
});
