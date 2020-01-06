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
router.get('/admin', restrict, (req, res, next) => {
    res.redirect('/admin/orders');
});

// logout
router.get('/admin/logout', (req, res) => {
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
});

router.get('/admin/register', (req, res) => {
    res.render('register', {
            title: 'Rejestracja',
			helpers: req.handlebars.helpers,
        });
});

// login form
router.get('/admin/login', async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // we check for a user. If one exists, redirect to login form otherwise setup
    if(userCount && userCount > 0){
        // set needsSetup to false as a user exists
        req.session.needsSetup = false;
        res.render('login', {
            title: 'Login',
            referringUrl: req.header('Referer'),
            config: req.app.config,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    }else{
        // if there are no users set the "needsSetup" session
        req.session.needsSetup = true;
        res.redirect('/admin/setup');
    }
});

// login the user and check the password
router.post('/admin/login_action', async (req, res) => {
    const db = req.app.db;

    const user = await db.users.findOne({ userEmail: common.mongoSanitize(req.body.email) });
    if(!user || user === null){
        res.status(400).json({ message: 'U�ytkownik o podanym mailu nie istnieje' });
        return;
    }

    // we have a user under that email so we compare the password
    bcrypt.compare(req.body.password, user.userPassword)
    .then((result) => {
        if(result){
            req.session.user = req.body.email;
            req.session.usersName = user.usersName;
            req.session.userId = user._id.toString();
            req.session.isAdmin = user.isAdmin;
            res.status(200).json({ message: 'Zalogowano pomy�lnie' });
            return;
        }
        // password is not correct
        res.status(400).json({ message: 'Odmowa dost�pu, sprawd� has�o' });
    });
});

// setup form is shown when there are no users setup in the DB
router.get('/admin/setup', async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // dont allow the user to "re-setup" if a user exists.
    // set needsSetup to false as a user exists
    req.session.needsSetup = false;
    if(userCount === 0){
        req.session.needsSetup = true;
        res.render('setup', {
            title: 'Inicjacja konta administratora',
            config: req.app.config,
            helpers: req.handlebars.helpers,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            showFooter: 'showFooter'
        });
        return;
    }
    res.redirect('/admin/login');
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
            console.error(colors.red('Nie uda�o si� wstawi� u�ytkownika: ' + ex));
            req.session.message = 'Setup failed';
            req.session.messageType = 'danger';
            res.redirect('/admin/setup');
            return;
        }
    }
    res.redirect('/admin/login');
});

// settings
router.get('/admin/settings', restrict, (req, res) => {
    res.render('settings', {
        title: 'Ustawienia ksiegarni',
        session: req.session,
        admin: true,
        themes: common.getThemes(),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        footerHtml: typeof req.app.config.footerHtml !== 'undefined' ? escape.decode(req.app.config.footerHtml) : null,
        googleAnalytics: typeof req.app.config.googleAnalytics !== 'undefined' ? escape.decode(req.app.config.googleAnalytics) : null
    });
});

// create API key
router.post('/admin/createApiKey', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    const result = await db.users.findOneAndUpdate({
        _id: ObjectId(req.session.userId),
        isAdmin: true
    }, {
        $set: {
            apiKey: new ObjectId()
        }
    }, {
        returnOriginal: false
    });

    if(result.value && result.value.apiKey){
        res.status(200).json({ message: 'Wygenerowany klucz API:', apiKey: result.value.apiKey });
        return;
    }
    res.status(400).json({ message: 'Nie uda�o si� wygenerowa� klucza API' });
});

// settings update
router.post('/admin/settings/update', restrict, checkAccess, (req, res) => {
    const result = common.updateConfig(req.body);
    if(result === true){
        req.app.config = common.getConfig();
        res.status(200).json({ message: 'Ustawienia zaktualizowano z sukcesem' });
        return;
    }
    res.status(400).json({ message: 'Odmowa dost�pu' });
});

// settings menu
router.get('/admin/settings/menu', restrict, async (req, res) => {
    const db = req.app.db;
    res.render('settings_menu', {
        title: 'Opcje menu',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// page list
router.get('/admin/settings/pages', restrict, async (req, res) => {
    const db = req.app.db;
    const pages = await db.pages.find({}).toArray();

    res.render('settings_pages', {
        title: 'Strony statyczne',
        pages: pages,
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// pages new
router.get('/admin/settings/pages/new', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    res.render('settings_page', {
        title: 'Strona',
        session: req.session,
        admin: true,
        button_text: 'Create',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// pages editor
router.get('/admin/settings/pages/edit/:page', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    const page = await db.pages.findOne({ _id: common.getId(req.params.page) });
    const menu = common.sortMenu(await common.getMenu(db));
    if(!page){
        res.status(404).render('error', {
            title: 'B��d 404, nie znaleziono strony',
            config: req.app.config,
            message: 'B��d 404, nie znaleziono strony',
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu
        });
        return;
    }

    res.render('settings_page', {
        title: 'Static pages',
        page: page,
        button_text: 'Update',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu
    });
});

// insert/update page
router.post('/admin/settings/page', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const doc = {
        pageName: req.body.pageName,
        pageSlug: req.body.pageSlug,
        pageEnabled: req.body.pageEnabled,
        pageContent: req.body.pageContent
    };

    if(req.body.pageId){
        // existing page
        const page = await db.pages.findOne({ _id: common.getId(req.body.pageId) });
        if(!page){
            res.status(400).json({ message: 'Nie znaleziono strony' });
            return;
        }

        try{
            const updatedPage = await db.pages.findOneAndUpdate({ _id: common.getId(req.body.pageId) }, { $set: doc }, { returnOriginal: false });
            res.status(200).json({ message: 'Stron� zaktualizowano z sukcesem', pageId: req.body.pageId, page: updatedPage.value });
        }catch(ex){
            res.status(400).json({ message: 'Wyst�pi� b��d, prosz� spr�bowa� ponownie' });
        }
    }else{
        // insert page
        try{
            const newDoc = await db.pages.insertOne(doc);
            res.status(200).json({ message: 'Utworzono now� stron� pomy�lnie', pageId: newDoc.insertedId });
            return;
        }catch(ex){
            res.status(400).json({ message: 'Wyst�pi� b��d, prosz� spr�bowa� ponownie' });
        }
    }
});

// delete page
router.post('/admin/settings/page/delete', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const page = await db.pages.findOne({ _id: common.getId(req.body.pageId) });
    if(!page){
        res.status(400).json({ message: 'Nie znaleziono strony' });
        return;
    }

    try{
        await db.pages.deleteOne({ _id: common.getId(req.body.pageId) }, {});
        res.status(200).json({ message: 'Stron� usuni�to pomy�lnie' });
        return;
    }catch(ex){
        res.status(400).json({ message: 'WYst�pi� b��d podczas usuwania strony, prosz� spr�bowa� ponownie' });
    }
});

// new menu item
router.post('/admin/settings/menu/new', restrict, checkAccess, (req, res) => {
    const result = common.newMenu(req);
    if(result === false){
        res.status(400).json({ message: 'B��d podczas tworzenia menu' });
        return;
    }
    res.status(200).json({ message: 'Menu zosta�o utworzone poprawnie' });
});

// update existing menu item
router.post('/admin/settings/menu/update', restrict, checkAccess, (req, res) => {
    const result = common.updateMenu(req);
    if(result === false){
        res.status(400).json({ message: 'B��d podczas aktualizacji menu' });
        return;
    }
    res.status(200).json({ message: 'Menu zosta�o zaktualizowane pomy�lnie.' });
});

// delete menu item
router.post('/admin/settings/menu/delete', restrict, checkAccess, (req, res) => {
    const result = common.deleteMenu(req, req.body.menuId);
    if(result === false){
        res.status(400).json({ message: 'B��d podczas usuwania menu' });
        return;
    }
    res.status(200).json({ message: 'Menu zosta�o usuni�te pomy�lnie.' });
});

// We call this via a Ajax call to save the order from the sortable list
router.post('/admin/settings/menu/save_order', restrict, checkAccess, (req, res) => {
    const result = common.orderMenu(req, res);
    if(result === false){
        res.status(400).json({ message: 'B��d podczas zmiany kolejno�ci menu' });
        return;
    }
    res.status(200);
});

// validate the permalink
router.post('/admin/api/validate_permalink', async (req, res) => {
    // if doc id is provided it checks for permalink in any products other that one provided,
    // else it just checks for any products with that permalink
    const db = req.app.db;

    let query = {};
    if(typeof req.body.docId === 'undefined' || req.body.docId === ''){
        query = { productPermalink: req.body.permalink };
    }else{
        query = { productPermalink: req.body.permalink, _id: { $ne: common.getId(req.body.docId) } };
    }

    const products = await db.products.countDocuments(query);
    if(products && products > 0){
        res.status(400).json({ message: 'Permalink ju� istnieje' });
        return;
    }
    res.status(200).json({ message: 'Walidacja permalinku zosta�a uko�czona pomy�lnie' });
});

// upload the file
const upload = multer({ dest: 'public/uploads/' });
router.post('/admin/file/upload', restrict, checkAccess, upload.single('uploadFile'), async (req, res) => {
    const db = req.app.db;

    if(req.file){
        const file = req.file;

        // Get the mime type of the file
        const mimeType = mime.lookup(file.originalname);

        // Check for allowed mime type and file size
        if(!common.allowedMimeType.includes(mimeType) || file.size > common.fileSizeLimit){
            // Remove temp file
            fs.unlinkSync(file.path);

            // Return error
            res.status(400).json({ message: 'Plik ma z�y format lub jest za du�y. Prosz� spr�bowa� ponownie.' });
            return;
        }

        // get the product form the DB
        const product = await db.products.findOne({ _id: common.getId(req.body.productId) });
        if(!product){
            // delete the temp file.
            fs.unlinkSync(file.path);

            // Return error
            res.status(400).json({ message: 'B��d podczas �adowania pliku na serwer. Prosz� spr�bowa� ponownie.' });
            return;
        }

        const productPath = product._id.toString();
        const uploadDir = path.join('public/uploads', productPath);

        // Check directory and create (if needed)
        common.checkDirectorySync(uploadDir);

        const source = fs.createReadStream(file.path);
        const dest = fs.createWriteStream(path.join(uploadDir, file.originalname.replace(/ /g, '_')));

        // save the new file
        source.pipe(dest);
        source.on('end', () => { });

        // delete the temp file.
        fs.unlinkSync(file.path);

        const imagePath = path.join('/uploads', productPath, file.originalname.replace(/ /g, '_'));

        // if there isn't a product featured image, set this one
        if(!product.productImage){
            await db.products.updateOne({ _id: common.getId(req.body.productId) }, { $set: { productImage: imagePath } }, { multi: false });
        }
         // Return success message
        res.status(200).json({ message: 'Plik zosta� wrzucony na stron� z sukcesem' });
        return;
    }
    // Return error
    res.status(400).json({ message: 'B��d podczas wrzucenia pliku na stron�. Prosz� spr�bowa� ponownie.' });
});

// delete a file via ajax request
router.post('/admin/testEmail', restrict, (req, res) => {
    const config = req.app.config;
    // TODO: Should fix this to properly handle result
    common.sendEmail(config.emailAddress, 'Test adresu e-mail', 'Ustawienia Twojego adresu e-mail s� poprawne');
    res.status(200).json({ message: 'Wys�ano test e-mail' });
});

module.exports = router;
