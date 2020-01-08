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

router.get('admin/register', restrict, (req, res, next) => {
    const db = req.app.db;
	const doc = {
        usersName: req.body.usersName,
        userEmail: req.body.usersEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: false,
        isOwner: false,
		usersSurname ; req.body.usersSurname,
		usersAddress ; req.body.usersAddress
    };
	console.log(doc);
	try{
            await db.users.insertOne(doc);
            req.session.message = 'User account inserted';
            req.session.messageType = 'success';
            return;
        }catch(ex){
            console.error(colors.red('Nie uda³o siê wstawiæ u¿ytkownika: ' + ex));
            req.session.message = 'Setup failed';
            req.session.messageType = 'danger';
            res.redirect('/admin/register');
            return;
        }
		
});

module.exports = router;