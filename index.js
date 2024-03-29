// Import Dependencies
const express = require('express');
const session = require('express-session');
const path = require('path');
var vaccineTracker = express();
var bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');

// Set up the view engine to use EJS
vaccineTracker.set('view engine', 'ejs');

//converting data into json format
vaccineTracker.use(express.json());
vaccineTracker.use(express.urlencoded({ extended: true }))


// Create Object Destructuring For Express Validator
const { check, validationResult } = require('express-validator');
const { stringify } = require('querystring');
const { log } = require('console');

// Express Body-Parser
vaccineTracker.use(express.urlencoded({ extended: true }));
//session
vaccineTracker.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true
}))

// Set Path to public and views forlder
vaccineTracker.set('views', path.join(__dirname, 'views'));
vaccineTracker.use(express.static(__dirname + '/public'));
vaccineTracker.set('view engine', 'ejs');


// Setup Database Connection
const mongoose = require('mongoose');

mongoose.connect("mongodb+srv://vaccineTracker:Vaccinetracker%40123@child-vaccination-track.oiqbkgy.mongodb.net/childvaccinetracker", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

////////////////////////////////////////////Registration Details for parents//////////////////////////////////////////

// Setup Database Model // Define Parent Schema
const parentSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    address: String,
    mobileNumber: String,
    sex: String,
    email: String,
    Spouse_firstName: String,
    Spouse_lastName: String,
    address: String,
    Spouse_mobileNumber: String,
    Spouse_Relation: String,
    Spouse_email: String,
    username: String,
    password: String
});


// Create Parent Model
const Parent_details = mongoose.model('parentsdetails', parentSchema);



// Setup Database Model 
//////////////////////////////////////////////////////////////// Define child Schema/////////////////////////////////////////////////
const childSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    sex: String,
    birthplace: String,
    parent_Id: { // Corrected field name
        type: mongoose.Schema.Types.ObjectId,
        ref: 'parentsdetails'
    }
});

// Create child Model
const child_details = mongoose.model('childrendetails', childSchema);

// Routes
//////////////////////////////////////// Parent Registration///////////////////////////////////////////////
vaccineTracker.post('/parent_registration', async (req, res, next) => {
    //getting details from the form
    const registrationdata = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        address: req.body.address,
        mobileNumber: req.body.mobileNumber,
        sex: req.body.sex,
        email: req.body.email,
        Spouse_firstName: req.body.Spouse_firstName,
        Spouse_lastName: req.body.Spouse_lastName,
        Spouse_mobileNumber: req.body.Spouse_mobileNumber,
        Spouse_Relation: req.body.Spouse_Relation,
        Spouse_email: req.body.Spouse_email,
        username: req.body.username,
        password: req.body.password
    }

    //checking for duplicate values
    const existingUseremail = await Parent_details.findOne({ email: registrationdata.email });
    const existingUsername = await Parent_details.findOne({ username: registrationdata.username });
    if (existingUseremail) {
        return res.status(409).send("Email id already exists, please try with different Email Id");
    } else if (existingUsername) {
        return res.status(409).send("Username already taken, Please use a different Username")
    } else {
        //hashing the password
        const salthassing = await bcrypt.genSalt(12);
        console.log("registration password  ata: " + registrationdata.password);
        registrationdata.password = await bcrypt.hash(registrationdata.password, salthassing);

        console.log("registration hased ata: " + JSON.stringify(registrationdata));

        //posting the details into mongo DB
        const createdUser = await Parent_details.create(registrationdata);

        res.status(201).json({ message: "Parent Registered Successfully" });

        // Redirect or render appropriate view after registration
        res.render("login-parent");
    }
});

///////////////////////////////////////////login for parent///////////////////////////////

vaccineTracker.post('/parentLoginHome', async (req, res) => {
    try {
        const userCheck = await Parent_details.findOne({ username: req.body.userName });

        if (!userCheck) {
            return res.status(401).send('Invalid User name!');
        }

        const ispasswordmatch = await bcrypt.compare(req.body.password, userCheck.password);

        if (ispasswordmatch) {
            const registrationDetails = {
                firstName: userCheck.firstName,
                lastName: userCheck.lastName,
                address: userCheck.address,
                mobileNumber: userCheck.mobileNumber,
                sex: userCheck.sex,
                email: userCheck.email,
                Spouse_firstName: userCheck.Spouse_firstName,
                Spouse_lastName: userCheck.Spouse_lastName,
                Spouse_mobileNumber: userCheck.Spouse_mobileNumber,
                Spouse_Relation: userCheck.Spouse_Relation,
                Spouse_email: userCheck.Spouse_email,
                username: userCheck.username,
                _id: userCheck._id
            };
            // Render the parentLoginHome view with registrationDetails
            req.session.registrationDetails = registrationDetails;

            const parentID = registrationDetails._id;
            console.log("Session before setting parentID:", req.session);
            req.session.parentID = parentID;
            console.log("Session after setting parentID:", req.session)

            // Fetch children details based on parent ID
            const children = await child_details.find({ parent_Id: userCheck._id });

            res.render('parentLoginHome', { registrationDetails: registrationDetails, children: children });

        } else {
            res.send("Wrong password");
        }
    }
    catch {
        res.send("Invalid Credentials");
    }

});


////////////////////////////////////////////////adding child details///////////////////////////////////////
//-------------------------------------------------------------------------------------------------------//

// Routes
//child registration
vaccineTracker.post('/add_child_vaccination', async (req, res) => {
    // Retrieve parent ID from session
    const parentID = req.session.parentID;

    // Ensure parent ID exists
    if (!parentID) {
        return res.status(400).send("Parent ID not found in session");
    }

    //getting details from the form
    const childRegistrationData = {
        firstName: req.body.childFirstName,
        lastName: req.body.childLastName,
        dateOfBirth: req.body.dateOfBirth,
        sex: req.body.sex,
        birthplace: req.body.birthplace,
        parent_Id: parentID
    }

    //checking for duplicate values
    const existingUser = await child_details.findOne({
        firstName: childRegistrationData.firstName,
        lastName: childRegistrationData.lastName,
        parent_Id: parentID
    });

    if (existingUser) {
        return res.status(409).send("Child's details already exist, please try with different details.");
    } else {
        //posting the details into mongo DB by Creating the child document in the child collection
        console.log('Created Child started:'); 
        const createdUser = await child_details.create(childRegistrationData);
        console.log('Created Child:', createdUser.parent_Id); // Log created child document for debugging
        
        // Render the addChildDetails template with parent ID
        res.render('addChildDetails', { registrationDetails: { _id: parentID } });
    }
});

/////////////////////////////////////////////////////////Setup Admin Database Model//////////////////////////////////////////////////////
const Admin = mongoose.model('Admin', {
    uName: String,
    pass: String
});


//////////////////////////////////////////////////////// Rendering to load pages/////////////////////////////////////
//Root Page Get Method (First time page load)
vaccineTracker.get('/', function (req, res) {
    res.render('Home');
});

vaccineTracker.get('/vaccinationDetails', function (req, res) {
    res.render('vaccinationDetails',);
});
vaccineTracker.get('/addVaccinationDetails', function (req, res) {
    res.render('addVaccinationDetails',);
});

vaccineTracker.get('/aboutUs', function (req, res) {
    res.render('aboutUs',);
});
vaccineTracker.get('/contactUs', function (req, res) {
    res.render('contactUs',);
});
vaccineTracker.get('/parent_registration', function (req, res) {
    res.render('parent_registration',);
});

// Root Page Post Method (Server Response)
vaccineTracker.post('/', [
], function (req, res) {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
        res.render('Home', { errors: errors.array() });

    } else {
        res.render('userConfirm', orderDB);
    }
});



//////////////////////////////////////////////////////// Route Handler//////////////////////////////////////////////////////

vaccineTracker.get('/parentLoginHome', async(req, res) => {
    console.log("get parent session:" + req.session);
    console.log("get parent reg :" + req.session.registrationDetails);
    // Check for session and registrationDetails existence
    if (req.session && req.session.registrationDetails) {
        console.log("get parent reg if caluse :" );
        const registrationDetails = req.session.registrationDetails; // Retrieve from session
        console.log("get parent reg if caluse :" +registrationDetails);
        const registrationDetailsStringified = JSON.stringify(registrationDetails);
        console.log("Stringified registrationDetails:", registrationDetailsStringified);

        const parentID = registrationDetails._id;
       
        // Fetch children details based on parent ID
        const children = await child_details.find({ parent_Id: parentID });

        res.render('parentLoginHome', { registrationDetails: registrationDetails, children: children });


      

    } else {

        // Handle case where session or data is missing (e.g., redirect to login)
        res.redirect('/login-parent');
    }
});
// vaccineTracker.get('/parentLoginHome', async (req, res) => {
//     try {
//         console.log("get parent 2 :" +JSON.stringify(req));
//         const parentID = req.session.parentID;
//         if (!parentID) {
//             return res.status(400).send("Parent ID not found in session");
//         }

//         // Fetch children details for the current parent from the database
//         const children = await child_details.find({ parent_Id: parentID });

//         // Render the parentLoginHome template with children details
//         res.render('parentLoginHome', { children: children });
//     } catch (error) {
//         console.error("Error fetching children:", error);
//         res.status(500).send("Internal Server Error");
//     }
// });

vaccineTracker.get('/addVaccinationDetails', async (req, res) => {
    try {
        console.error(" child id for the session :  " + childId);
        const childId = req.query.childId; // Retrieve child ID from query string
        console.error(" child id for the session :  " + childId);

        // Find the child by ID
        const child = await child_details.findById(childId);

        if (!child) {
            return res.status(404).send('Child not found');
        }

        // Render the addVaccinationDetails.ejs template and pass the child object
        res.render('addVaccinationDetails', { child: child });
    } catch (error) {
        console.error('Error rendering addVaccinationDetails:', error);
        res.status(500).send('Internal server error');
    }
});



vaccineTracker.get('/addChildDetails', (req, res) => {
    const registrationDetails = req.session.registrationDetails;
    if (registrationDetails) {
        res.render('addChildDetails', { registrationDetails: registrationDetails });
    } else {
        // Handle case where session data is missing
        res.redirect('/login-parent');
    }
});


vaccineTracker.get('/childDetails', (req, res) => {
    if (req.session && req.session.childRegistrationData) {
        const childRegistrationData = req.session.childRegistrationData; // Retrieve from session
        res.render('childDetails', { childRegistrationData: childRegistrationData }); // Pass to template

    } else {
        // Handle case where session or data is missing (e.g., redirect to login)
        res.redirect('/addChildDetails');
    }
});


//////////////////////////////////////////////////////// Logout Page//////////////////////////////////////////////////////

vaccineTracker.get('/logout', (req, res) => {
    req.session.username = '';
    req.session.userLoggedIn = false;
    res.render('login-parent', { error: "Logout Successfully! " });
});


//////////////////////////////////////////////////////// Login Page//////////////////////////////////////////////////////
vaccineTracker.get('/login-parent', (req, res) => {
    res.render('login-parent');
});
vaccineTracker.get('/login-adult', (req, res) => {
    res.render('login-adult');
});
vaccineTracker.get('/login-admin', (req, res) => {
    res.render('login-admin');
});
////////////////////////////////////////////////////// Delete Child Route////////////////////////////////////////////////
vaccineTracker.post('/deleteChild',async (req, res) => {
    try {
        const childId = req.body.childId;

        // Check if the childId is provided
        if (!childId) {
            return res.status(400).send('Child ID is required');
        }

        // Find the child document in the database
        const child = await child_details.findById(childId);

        // If the child document does not exist, return an error
        if (!child) {
            return res.status(404).send('Child not found');
        }

        // Delete the child document from the database
        await child_details.findByIdAndDelete(childId);

        // Redirect back to the parentLoginHome page
        res.redirect('/parentLoginHome');
    } catch (error) {
        console.error('Error deleting child:', error);
        res.status(500).send('Error deleting child');
    }
});

////////////////////////////////////////////////// Add Child Vaccination Route///////////////////////////////////////////
vaccineTracker.get('/addChildVaccination', (req, res) => {
    const childId = req.query.childId;
    // Render a form to add vaccination details for the child
});





// Post Login-admin Page
vaccineTracker.post('/login-parent', [
    check('userName', 'User Name is required!').notEmpty(),
    check('password', 'Password is required!').notEmpty(),
], (req, res) => {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
        // Display Error Messages
        res.render('login-admin', { errors: errors.array() });
    } else {
        console.log(req.body);
        var userName = req.body.userName;
        var password = req.body.password;
        console.log(`userName=${userName} and password: ${password}`);
        //Validate against DB
        Admin.findOne({ aname: userName, pass: password }).then((admin) => {
            console.log(`Admin result from db: ${admin}`);
            if (admin) {
                req.session.username = admin.username;
                req.session.userLoggedIn = true;
                res.redirect('/userDetails');
            } else {
                res.render('login-admin', { errors: "Sorry Login Failed. Please Try Again!" });
                console.log(errors);
            }

        }).catch((err) => {
            console.log(`Error: ${err}`);
        })
    }
});

// Error handling middleware function
// This function is called when an error occurs in the application
// It logs the error stack trace to the console for debugging purposes
// and sends a response with a 500 status code and a generic message to the user

vaccineTracker.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});



// Execute Website Using Port Number for Localhost
vaccineTracker.listen(2705);
console.log('Website Executed Sucessfully....Open Using http://localhost:2705/');