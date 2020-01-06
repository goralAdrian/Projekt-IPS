const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const escape = require('html-entities').AllHtmlEntities;
const colors = require('colors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mime = require('mime-type/with-db');
const ObjectId = require('mongodb').ObjectID;
const router = express.Router();

// Admin section
router.get('/register', restrict, (req, res, next) => {
    
});



// insert a user
router.post('/admin/setup_action', async (req, res) => {
    const db = req.app.db;

    const doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: true,
        isOwner: true
    };

    // check for users
    const userCount = await db.users.countDocuments({});
    if(userCount === 0){
        // email is ok to be used.
        try{
            await db.users.insertOne(doc);
            req.session.message = 'User account inserted';
            req.session.messageType = 'success';
            res.redirect('/admin/login');
            return;
        }catch(ex){
            console.error(colors.red('Nie uda³o siê wstawiæ u¿ytkownika: ' + ex));
            req.session.message = 'Setup failed';
            req.session.messageType = 'danger';
            res.redirect('/admin/setup');
            return;
        }
    }
    res.redirect('/admin/login');
});

module.exports = router;