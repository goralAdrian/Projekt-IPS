const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const paypal = require('paypal-rest-sdk');
const router = express.Router();

router.get('/checkout_cancel', (req, res, next) => {
    res.redirect('/checkout');
});

router.get('/payNow', (req, res, next) => {
	
});


router.post('/checkout_action', (req, res, next) => {
	
});

module.exports = router;