const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const { indexProducts } = require('../lib/indexing');
const { validateJson } = require('../lib/schema');
const colors = require('colors');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/admin/products', restrict, async (req, res, next) => {
    const db = req.app.db;
    // get the top results
    const topResults = await db.products.find({}).sort({ productAddedDate: -1 }).limit(10).toArray();
    res.render('products', {
        title: 'Koszyk',
        top_results: topResults,
        session: req.session,
        admin: true,
        config: req.app.config,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

router.get('/admin/products/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const productsIndex = req.app.productsIndex;

    const lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    const results = await db.products.find({ _id: { $in: lunrIdArray } }).toArray();

    if(req.apiAuthenticated){
        res.status(200).json(results);
        return;
    }

    res.render('products', {
        title: 'Results',
        results: results,
        admin: true,
        config: req.app.config,
        session: req.session,
        searchTerm: searchTerm,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

// insert form
router.get('/admin/product/new', restrict, checkAccess, (req, res) => {
    res.render('product_new', {
        title: 'New product',
        session: req.session,
        productTitle: common.clearSessionValue(req.session, 'productTitle'),
        productDescription: common.clearSessionValue(req.session, 'productDescription'),
        productPrice: common.clearSessionValue(req.session, 'productPrice'),
        productPermalink: common.clearSessionValue(req.session, 'productPermalink'),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        editor: true,
        admin: true,
        helpers: req.handlebars.helpers,
        config: req.app.config
    });
});

// insert new product form action
router.post('/admin/product/insert', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    // Process supplied options
    let productOptions = req.body.productOptions;
    if(productOptions && typeof productOptions !== 'object'){
        try{
            productOptions = JSON.parse(req.body.productOptions);
        }catch(ex){
            console.log('Failure to parse options');
        }
    }

    const doc = {
        productPermalink: req.body.productPermalink,
        productTitle: common.cleanHtml(req.body.productTitle),
        productPrice: common.safeParseInt(req.body.productPrice),
        productDescription: common.cleanHtml(req.body.productDescription),
        productPublished: common.convertBool(req.body.productPublished),
        productTags: req.body.productTags,
        productOptions: productOptions || null,
        productComment: common.checkboxBool(req.body.productComment),
        productAddedDate: new Date(),
        productStock: common.safeParseInt(req.body.productStock) || null
    };

    // Validate the body again schema
    const schemaValidate = validateJson('newProduct', doc);
    if(!schemaValidate.result){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json(schemaValidate.errors);
            return;
        }

        console.log('schemaValidate errors', schemaValidate.errors);
        req.session.message = 'Zosta³y wprowadzone z³e dane, proszê sprawdziæ poprawnoœæ danych';
        req.session.messageType = 'danger';

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productOptions = productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productTags = req.body.productTags;
        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

        // redirect to insert
        res.redirect('/admin/product/new');
        return;
    }

    // Check permalink doesn't already exist
    const product = await db.products.countDocuments({ productPermalink: req.body.productPermalink });
    if(product > 0 && req.body.productPermalink !== ''){
        // permalink exits
        req.session.message = 'Permalink ju¿ istnieje. Proszê wybraæ nowy.';
        req.session.messageType = 'danger';

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productOptions = productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productTags = req.body.productTags;
        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ error: 'Permalink ju¿ istnieje. Proszê wybraæ nowy.' });
            return;
        }

        // redirect to insert
        res.redirect('/admin/product/new');
        return;
    }

    try{
        const newDoc = await db.products.insertOne(doc);
        // get the new ID
        const newId = newDoc.insertedId;

        // add to lunr index
        indexProducts(req.app)
        .then(() => {
            req.session.message = 'Dodano now¹ ksi¹¿kê pomyœlnie';
            req.session.messageType = 'success';

            // If API request, return json
            if(req.apiAuthenticated){
                res.status(200).json({ message: 'Dodano now¹ ksi¹¿kê pomyœlnie' });
                return;
            }

            // redirect to new doc
            res.redirect('/admin/product/edit/' + newId);
        });
    }catch(ex){
        console.log(colors.red('B³¹d podczas tworzenia dokumentacji: ' + ex));

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productOptions = productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productTags = req.body.productTags;
        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

        req.session.message = 'B³¹d podczas dodawania ksi¹¿ki';
        req.session.messageType = 'danger';

        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ error: 'B³¹d podczas dodawania ksi¹¿ki' });
            return;
        }

        // redirect to insert
        res.redirect('/admin/product/new');
    }
});

// render the editor
router.get('/admin/product/edit/:id', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const images = await common.getImages(req.params.id, req, res);
    const product = await db.products.findOne({ _id: common.getId(req.params.id) });
    if(!product){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Nie znaleziono ksi¹¿ki' });
            return;
        }
        req.session.message = 'Nie znaleziono ksi¹¿ki';
        req.session.messageType = 'danger';
        res.redirect('/admin/products');
        return;
    }
    let options = {};
    if(product.productOptions){
        options = product.productOptions;
    }

    // If API request, return json
    if(req.apiAuthenticated){
        res.status(200).json(product);
        return;
    }

    res.render('product_edit', {
        title: 'Edycja ksi¹¿ki',
        result: product,
        images: images,
        options: options,
        admin: true,
        session: req.session,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        config: req.app.config,
        editor: true,
        helpers: req.handlebars.helpers
    });
});

// Remove option from product
router.post('/admin/product/removeoption', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    const product = await db.products.findOne({ _id: common.getId(req.body.productId) });
    if(product && product.productOptions){
        const opts = product.productOptions;
        delete opts[req.body.optName];

        try{
            const updateOption = await db.products.updateOne({ _id: common.getId(req.body.productId) }, { $set: { productOptions: opts } });
            if(updateOption.result.nModified === 1){
                res.status(200).json({ message: 'Opcjê usuniêto pomyœlnie' });
                return;
            }
            res.status(400).json({ message: 'Nie uda³o siê usun¹æ opcji, proszê spróbowaæ póŸniej' });
            return;
        }catch(ex){
            res.status(400).json({ message: 'Failed to remove option. Please try again.' });
            return;
        }
    }
    res.status(400).json({ message: 'Ksi¹¿ki nie znaleziono. Proszê zapisaæ ksi¹¿kê przed usuniêciem jej.' });
});

// Update an existing product form action
router.post('/admin/product/update', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const product = await db.products.findOne({ _id: common.getId(req.body.productId) });

    if(!product){
        req.session.message = 'Nie uda³o siê zaktualizowaæ ksi¹¿ki';
        req.session.messageType = 'danger';

        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ messge: 'Nie uda³o siê zaktualizowaæ ksi¹¿ki' });
            return;
        }

        res.redirect('/admin/product/edit/' + req.body.productId);
        return;
    }
    const count = await db.products.countDocuments({ productPermalink: req.body.productPermalink, _id: { $ne: common.getId(product._id) } });
    if(count > 0 && req.body.productPermalink !== ''){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ messge: 'Permalink ju¿ istnieje. Proszê wybraæ nowy.' });
            return;
        }

        // permalink exits
        req.session.message = 'Permalink ju¿ istnieje. Proszê wybraæ nowy.';
        req.session.messageType = 'danger';

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productTags = req.body.productTags;
        req.session.productOptions = req.body.productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productStock = req.body.productStock ? req.body.productStock : null;

        // redirect to insert
        res.redirect('/admin/product/edit/' + req.body.productId);
        return;
    }
    const images = await common.getImages(req.body.productId, req, res);
    // Process supplied options
    let productOptions = req.body.productOptions;
    if(productOptions && typeof productOptions !== 'object'){
        try{
            productOptions = JSON.parse(req.body.productOptions);
        }catch(ex){
            console.log('B³¹d podczas parsowania opcji');
        }
    }

    const productDoc = {
        productId: req.body.productId,
        productPermalink: req.body.productPermalink,
        productTitle: common.cleanHtml(req.body.productTitle),
        productPrice: common.safeParseInt(req.body.productPrice),
        productDescription: common.cleanHtml(req.body.productDescription),
        productPublished: common.convertBool(req.body.productPublished),
        productTags: req.body.productTags,
        productOptions: productOptions || null,
        productComment: common.checkboxBool(req.body.productComment),
        productStock: common.safeParseInt(req.body.productStock) || null
    };

    // Validate the body again schema
    const schemaValidate = validateJson('editProduct', productDoc);
    if(!schemaValidate.result){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json(schemaValidate.errors);
            return;
        }
        
        req.session.message = 'Zosta³y wprowadzone z³e dane, sprawdŸ je i spróbuj ponownie';
        req.session.messageType = 'danger';

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productOptions = productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productTags = req.body.productTags;
        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

        // redirect to insert
        res.redirect('/admin/product/edit/' + req.body.productId);
        return;
    }

    // Remove productId from doc
    delete productDoc.productId;

    // if no featured image
    if(!product.productImage){
        if(images.length > 0){
            productDoc.productImage = images[0].path;
        }else{
            productDoc.productImage = '/uploads/placeholder.png';
        }
    }else{
        productDoc.productImage = product.productImage;
    }

    try{
        await db.products.updateOne({ _id: common.getId(req.body.productId) }, { $set: productDoc }, {});
        // Update the index
        indexProducts(req.app)
        .then(() => {
            // If API request, return json
            if(req.apiAuthenticated){
                res.status(200).json({ message: 'Zapisano pomyœlnie', product: productDoc });
                return;
            }

            req.session.message = 'Zapisano pomyœlnie';
            req.session.messageType = 'success';
            res.redirect('/admin/product/edit/' + req.body.productId);
        });
    }catch(ex){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ messge: 'Nie uda³o siê zapisaæ. Spróbuj ponownie' });
            return;
        }

        console.error(colors.red('Nie uda³o siê zapisaæ ksi¹¿ki: ' + ex));
        req.session.message = 'Nie uda³o siê zapisaæ. Spróbuj ponownie';
        req.session.messageType = 'danger';
        res.redirect('/admin/product/edit/' + req.body.productId);
    }
});

// delete product
router.get('/admin/product/delete/:id', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    // remove the product
    await db.products.deleteOne({ _id: common.getId(req.params.id) }, {});

    // delete any images and folder
    rimraf('public/uploads/' + req.params.id, (err) => {
        if(err){
            console.info(err.stack);
        }

        // re-index products
        indexProducts(req.app)
        .then(() => {
            // redirect home
            req.session.message = 'Pomyœlnie usuniêto ksi¹¿kê';
            req.session.messageType = 'success';
            res.redirect('/admin/products');
        });
    });
});

// update the published state based on an ajax call from the frontend
router.post('/admin/product/published_state', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    try{
        await db.products.updateOne({ _id: common.getId(req.body.id) }, { $set: { productPublished: common.convertBool(req.body.state) } }, { multi: false });
        res.status(200).json('Zaktualizowano status');
    }catch(ex){
        console.error(colors.red('Nie uda³o siê zaktualizowaæ statusu: ' + ex));
        res.status(400).json('Nie uda³o siê aktualizowaæ statusu');
    }
});

// set as main product image
router.post('/admin/product/setasmainimage', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    try{
        // update the productImage to the db
        await db.products.updateOne({ _id: common.getId(req.body.product_id) }, { $set: { productImage: req.body.productImage } }, { multi: false });
        res.status(200).json({ message: 'Pomyœlnie ustawiono zdjêcie ksi¹¿ki.' });
    }catch(ex){
        res.status(400).json({ message: 'Nie uda³o siê ustawiæ domyœlnego zdjêcia ksi¹¿ki, spróbuj ponownie.' });
    }
});

// deletes a product image
router.post('/admin/product/deleteimage', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    // get the productImage from the db
    const product = await db.products.findOne({ _id: common.getId(req.body.product_id) });
    if(!product){
        res.status(400).json({ message: 'Nie znalezniono ksi¹¿ki' });
        return;
    }
    if(req.body.productImage === product.productImage){
        // set the productImage to null
        await db.products.updateOne({ _id: common.getId(req.body.product_id) }, { $set: { productImage: null } }, { multi: false });

        // remove the image from disk
        fs.unlink(path.join('public', req.body.productImage), (err) => {
            if(err){
                res.status(400).json({ message: 'Nie uda³o sie usun¹æ zdjêcia ksi¹¿ki, spróbuj ponownie.' });
            }else{
                res.status(200).json({ message: 'Usuniêcie zdjêcia powiod³o siê' });
            }
        });
    }else{
        // remove the image from disk
        fs.unlink(path.join('public', req.body.productImage), (err) => {
            if(err){
                res.status(400).json({ message: 'Nie uda³o sie usun¹æ zdjêcia ksi¹¿ki, spróbuj ponownie.' });
            }else{
                res.status(200).json({ message: 'Usuniêcie zdjêcia powiod³o siê' });
            }
        });
    }
});

module.exports = router;
