const express = require('express');
const { check, body } = require('express-validator')

const authController = require('../controllers/auth');
const User = require('../models/user')

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.get('/reset', authController.getReset);

router.get('/reset/:token', authController.getNewPassword)

router.post('/reset', authController.postReset);

router.post('/login',
    [body('email', 'Invalid Password')
        .isEmail()
        .normalizeEmail(),
    body('password', 'Invalid Password').isLength({ min: 4 }).isAlphanumeric().trim()],
    authController.postLogin);

router.post('/signup',
    [check('email')
        .isEmail()
        .withMessage('Please enter a valid email')
        .custom((value, { req }) => {
            // if (value === 'test@test.com') {
            //     throw new Error('This is a forbidden email.')
            // }
            // return true
            return User.findOne({ email: value }).then(userDoc => {
                if (userDoc) {
                    return Promise.reject('Email already exists!')
                }
            })
        }).normalizeEmail()
        ,
    body('phone',
        'Please enter a valid phone number').
        isLength({ min: 10, max: 10 })
        .isNumeric()
        // .custom((value, { req }) => {
        //     // if (value === 'test@test.com') {
        //     //     throw new Error('This is a forbidden email.')
        //     // }
        //     // return true
        //     console.log(value)
        //     return User.findOne({ phone: value }).then(userDoc => {
        //         if (userDoc) {
        //             return Promise.reject('Phone number already exists! Please use a different phone number')
        //         }
        //     })
        // })
        ,
    body(
        'password',
        'Please enter a password with only numbers and text and atleast 4 characters.')
        .isLength({ min: 4 })
        .isAlphanumeric()
        .trim(),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password have to match!')
            }
            return true
        })

    ]
    , authController.postSignup);

router.post('/logout', authController.postLogout);

router.post('/new-password', authController.postNewPassword);

module.exports = router;