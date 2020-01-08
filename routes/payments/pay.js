const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const paypal = require('paypal-rest-sdk');
const router = express.Router();

router.get('/checkout_cancel', (req, res, next) => {
    res.redirect('/checkout');
});

router.get('/pay/payNow', (req, res, next) => {
    console.log('router /pay/payNow');
    
    const db = req.app.db;

	thisTime = new Date();
    user = req.session.user;
    allMoney = req.session.totalCartAmount;
	cart = req.session.cart;
	console.log(cart);
	
	db.orders.insertOne(
				{
				"orderTotal" : allMoney,
				"user" : user,
				"cart" : cart,
				"thisTime" : thisTime
				}
		)
	req.session.cart = null;
	console.log('dodano');
	
	
	
	res.redirect('/');
});


router.post('/checkout_action', (req, res, next) => {
	
});

function ImPayFunction()
{
    
    console.log('ImPayFunction');
    
	const db = req.app.db;
	const ordersCount = db.orders.countDocuments({});
	
	user = req.session.user;
	allMoney = req.session.totalCartAmount;
	mail = req.session.userEmail;
	if(ordersCount)
	{
	id = ordersCount + 1;
	}
	else
	{
		id = ordersCount = 1;
	}
	db.orders.insertOne(
		{
		"_id" : id,
		"orderTotal" : allMoney,
		"orderTotal" : mail
		}
	)
	
	
	return 1;
}

module.exports = router;