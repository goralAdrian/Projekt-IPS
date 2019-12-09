exports.createPostValidator = (req, res, next) => {
    req.check("title", "Dodaj tytuł").notEmpty();
    req.check("title", "Tytuł posta musi zawierać od 4 do 2000 znaków").isLength({
        min: 4,
        max: 150
    });
    req.check("body", "Dodaj treść").notEmpty();
    req.check("body", "Treść posta musi zawierać od 4 do 2000 znaków").isLength({
        min: 4,
        max: 2000
    });
    const errors = req.validationErrors();
    if (errors) {
        const firstError = errors.map(error => error.msg)[0];
        return res.status(400).json({ error: firstError });
    }
    next();
};

exports.userSignupValidator = (req, res, next) => {
    req.check("name", "Login jest wymagany").notEmpty();
    req.check("email", "Email musi zawierać 3-32 znaki")
        .matches(/.+\@.+\..+/)
        .withMessage("Email musi zawierać @")
        .isLength({
            min: 3,
            max: 32
        });
    req.check("password", "Hasło jest wymagane").notEmpty();
    req.check("password")
        .isLength({ min: 6 })
        .withMessage("Hasło musi zawierać przynajmniej 6 znaków")
        .matches(/\d/)
        .withMessage("Hasło musi zawierać cyfrę");
    const errors = req.validationErrors();
    if (errors) {
        const firstError = errors.map(error => error.msg)[0];
        return res.status(400).json({ error: firstError });
    }
    next();
};
