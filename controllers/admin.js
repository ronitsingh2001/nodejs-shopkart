const fileHelper = require('../utils/file')


const { validationResult } = require('express-validator')
const Product = require('../models/product');

const ITEM_PER_PAGE = 4;


exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product',
        {
            editing: false,
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            hasError: false,
            errorMessage: null,
            validationError: []
        });
}


exports.postAddProduct = (req, res, next) => {
    // products.push({ title: req.body.title });
    const title = req.body.title;
    const image = req.file;
    const price = req.body.price;
    const description = req.body.description;

    const errors = validationResult(req);
    // console.log(image)
    if (!image) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description
            },
            errorMessage: 'Attached file is not an image.',
            validationError: []
        });
    }

    if (!errors.isEmpty()) {
        console.log(errors.array())
        return res.status(422).render('admin/edit-product',
            {
                pageTitle: 'Add Product',
                path: '/admin/edit-product',
                editing: false,
                hasError: true,
                product: {
                    title: title,
                    price: price,
                    description: description
                },
                validationError: errors.array(),
                errorMessage: errors.array()[0].msg,
            });

    }

    const product = new Product({
        // _id: new mongoose.Types.ObjectId('6495b0c7029671624d6ab4f6'),
        title: title,
        price: price,
        description: description,
        imageUrl: image.path,
        userId: req.user._id
        // userId: req.user._id
    });
    product.save()
        .then(result => {
            console.log('Product Created!')
            res.redirect('/admin/products')
        }).catch(err => {
            // return res.status(500).render('admin/edit-product',
            //     {
            //         pageTitle: 'Add Product',
            //         path: '/admin/edit-product',
            //         editing: false,
            //         hasError: true,
            //         product: {
            //             title: title,
            //             imageUrl: imageUrl,
            //             price: price,
            //             description: description
            //         },
            //         errorMessage: "Some Error Occured in the database!!",
            //         validationError: []
            //     });
            // return res.redirect('/500')
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
            // console.log(err)
        })

    // ************When using file system or mysql directly ****** 
    // const product = new Product(null, title, imageUrl, price, description);
    // product.save().then(() => {
    //     res.redirect('/');
    // }).catch(err => {
    //     console.log(err)
    // })
}

exports.getEditProduct = (req, res, next) => {
    const editMode = req.query.edit;
    if (!editMode) {
        return res.redirect('/');
    }
    const prodId = req.params.productId;
    Product.findById(prodId).then(product => {
        if (!product) {
            return res.redirect('/');
        }
        res.render('admin/edit-product',
            {
                pageTitle: 'Edit Product',
                path: '/admin/edit-product',
                editing: editMode,
                product: product,
                hasError: false,
                errorMessage: null,
                validationError: []
            });
    }).catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    })
}

exports.postEditProduct = (req, res, next) => {
    const prodId = req.body.productId;
    const updatedTitle = req.body.title;
    const image = req.file;
    const updatedPrice = req.body.price;
    const updatedDescription = req.body.description;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log(errors.array())
        return res.status(422).render('admin/edit-product',
            {
                pageTitle: 'Edit Product',
                path: '/admin/edit-product',
                editing: true,
                hasError: true,
                product: {
                    title: updatedTitle,
                    price: updatedPrice,
                    description: updatedDescription,
                    _id: prodId
                },
                errorMessage: errors.array()[0].msg,
                validationError: errors.array()
            });
    }

    Product.findById(prodId).then(product => {
        if (product.userId.toString() !== req.user._id.toString()) {
            return res.redirect('/')
        }

        product.title = updatedTitle;
        product.price = updatedPrice;
        product.description = updatedDescription;
        if (image) {
            fileHelper.deleteFile(product.imageUrl);
            product.imageUrl = image.path;
        }
        return product.save().then(result => {
            console.log("Product Updated")
            res.redirect('/admin/products')
        })
    }).catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    })
}



exports.getAdminProducts = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;
    Product.find({ userId: req.user._id }).count().then(numProducts => {
        totalItems = numProducts;
        return Product.find({ userId: req.user._id }).skip((page - 1) * ITEM_PER_PAGE).limit(ITEM_PER_PAGE)
    })
        // .select('title price -_id')
        // .populate('userId', 'name')
        .then(products => {
            console.log(products)
            res.render('admin/products', {
                pageTitle: 'Admin Products',
                prods: products,
                path: '/admin/products',
                currentPage: page,
                totalProducts: totalItems,
                hasNextPage: ITEM_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems / ITEM_PER_PAGE)
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}
// Product.fetchAll().then(([rows, fieldData]) => {
//     res.render('admin/products', {
//         pageTitle: 'Admin Products',
//         prods: rows,
//         path: '/admin/products'
//     });
// }).catch(err => {
//     console.log(err)
// })

// }

exports.deleteProduct = (req, res, next) => {
    const prodId = req.params.productId;
    Product.findById(prodId)
        .then(prod => {
            if (!prod) {
                return next(new Error("Product Not Found!"))
            }
            fileHelper.deleteFile(prod.imageUrl)
            return Product.deleteOne({ _id: prodId, userId: req.user._id })
        })
        .then(result => {
            console.log('Product Deleted')
            res.status(200).json({
                message: 'Success!'
            })
        }).catch(err => {
            res.status(500).json({
                message: 'Deleting product failed!'
            })
        })
}