const express = require('express');

const { body } = require('express-validator')

const adminController = require('../controllers/admin')
const isAuth = require('../middleware/is-auth')

const router = express.Router()

const productFormValidation = [
    body('title')
        .isLength({ min: 3 })
        .isString().trim()
    ,
    body('price')
        .trim()
        .isFloat()
    ,
    body('description')
        .isLength({ min: 8, max: 400 })

];


router.get('/add-product', isAuth, adminController.getAddProduct);
router.get('/products', isAuth, adminController.getAdminProducts)

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

// // // /admin/add-product => POST
router.post('/add-product', productFormValidation, isAuth, adminController.postAddProduct);
router.post('/edit-product', productFormValidation, isAuth, adminController.postEditProduct);
router.delete('/product/:productId', isAuth, adminController.deleteProduct);

module.exports = router;