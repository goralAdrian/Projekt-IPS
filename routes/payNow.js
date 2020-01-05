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


router.post('/payNow', async (req, res) => {
	res.render('payNow', {
            title: 'Potwierdzenie zakupu',
            showFooter: 'showFooter'
	});
});
router.post('/payNow/payed', async (req, res) => {

	res.redirect('/');
});

module.exports = router;
