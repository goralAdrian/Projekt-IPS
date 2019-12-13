const { getConfig } = require('./common');
const { initDb } = require('./db');
const { fixProductDates } = require('./indexing');
const fs = require('fs');
const path = require('path');

const testData = fs.readFileSync(path.join(__dirname, '..', 'bin', 'testdata.json'), 'utf-8');
const jsonData = JSON.parse(testData);

// get config
const config = getConfig();

initDb(config.databaseConnectionString, (err, db) => {
    Promise.all([
        db.users.deleteMany({}, {}),
        db.customers.deleteMany({}, {}),
        db.products.deleteMany({}, {}),
        db.menu.deleteMany({}, {})
    ])
    .then(() => {
        Promise.all([
            db.users.insertMany(jsonData.users),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(fixProductDates(jsonData.products)),
            db.menu.insertOne(jsonData.menu)
        ])
        .then(() => {
            console.log('Test danych zosta³ ukoñczony pomyœlnie');
            process.exit();
        })
        .catch((err) => {
            console.log('Wprowadzono z³e dane', err);
            process.exit(2);
        });
    })
    .catch((err) => {
        console.log('B³¹d podczas usuwania istniej¹cych danych', err);
        process.exit(2);
    });
});
