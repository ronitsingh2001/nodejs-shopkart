const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const mongodbStore = require('connect-mongodb-session')(session)
const csrf = require('csurf');
const flash = require('connect-flash')
const multer = require('multer')
const compression = require('compression')

const errorController = require('./controllers/error')
const User = require('./models/user')

const shopController = require('./controllers/shop')
const isAuth = require('./middleware/is-auth')

// console.log(process.env.NODE_ENV)

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.pzq3t8g.mongodb.net/${process.env.MONGO_DB}`


const app = express();


const store = new mongodbStore({
    uri: MONGODB_URI,
    collection: 'sessions'
})

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'inputs/images')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now()
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png'|| file.mimetype === 'image/jpg'|| file.mimetype === 'image/jpeg'|| file.mimetype === 'image/avif') {
        cb(null, true)
    } else {
        cb(null, false)
    }
}
// const fileStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'images');
//     },
//     filename: (req, file, cb) => {
//         cb(null, new Date().toISOString() + '-' + file.originalname)
//     }
// })

const csrfProtection = csrf()

// ********* Telling Node About view engine **********
app.set('view engine', 'ejs');
app.set('views', 'views')


// ********* importing Routes ****************
const adminRoutes = require('./routes/admin')
const shopRoutes = require('./routes/shop')
const authRoutes = require('./routes/auth')


app.use(compression())

// ***************Parsing request data********** //
app.use(multer({ storage: storage, fileFilter: fileFilter }).single('image'));
app.use(bodyParser.urlencoded({ extended: false }));

// ********* Serving files data statically ****************
app.use(express.static(path.join(__dirname, 'public')))
app.use('/inputs', express.static(path.join(__dirname, 'inputs')))

// ******Storing session***********
app.use(session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
}))

app.use(flash())



// ********* Setting user attribut eto request if found **************
app.use((req, res, next) => {
    // throw new Error('Dummy')
    if (!req.session.user) {
        return next()
    }
    User.findById(req.session.user._id)
        .then(user => {
            if (!user) {
                return next()
            }
            req.user = user;
            // console.log(user)
            next()
        })
        .catch(err => {
            next(new Error(err))
            // throw new Error(err)
        })
})


// ***********crsf attack avoidance **********
app.use(csrfProtection);

app.post('/create-order', isAuth, shopController.postOrders);

// *********Setting local variables so that they are available to all requests **************
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next()
})
// *********** Providing routes ************ 
app.use('/admin/', adminRoutes)
app.use(shopRoutes)
app.use(authRoutes)

// ***********Error Routes ***********
app.use('/500', errorController.get500Page)
app.use(errorController.get404Page);


// ******** Express error handling ***********
app.use((err, req, res, next) => {
    console.log(err)
    res.status(500).render('500', {
        pageTitle: 'Error',
        path: '/500',
        isAuthenticated: req.session.isLoggedIn
    });
})

// ************** Connecting to mongoDB ***********
mongoose.connect(MONGODB_URI)
    .then(result => {
        // User.findOne().then(user => {
        //     if (!user) {
        //         const user = new User({
        //             name: 'Krish',
        //             email: 'kt@g.com',
        //             cart: {
        //                 items: []
        //             }
        //         })
        //         user.save().then(result => {
        //             console.log('User Created!')
        //         })
        //     }
        // })
        app.listen(process.env.PORT || 3000)
        console.log('Connected!')
    })
    .catch(err => {
        console.log(err)
    })
