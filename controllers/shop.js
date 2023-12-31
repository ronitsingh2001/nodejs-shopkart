const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit')

const Product = require('../models/product')
const Order = require('../models/order')

// const stripe = require('stripe')('sk_test_51NOF2HSIMciTFZ5IOlRH0cCxTiVebf2pGtC5Cyr4phWBHiyLNci87axvYYgXhCPmZTg54WajwY9aIZrsqKw9mtOz002GvPmK54')

const ITEM_PER_PAGE = 8;


exports.getProducts = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;
    Product.find().count().then(numProducts => {
        totalItems = numProducts
        return Product.find().skip((page - 1) * ITEM_PER_PAGE).limit(ITEM_PER_PAGE)
    })
        .then(products => {
            // console.log(products)
            res.render('shop/product-list', {
                prods: products,
                pageTitle: 'All Products',
                path: '/products',
                currentPage: page,
                totalProducts: totalItems,
                hasNextPage: ITEM_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: Math.ceil(totalItems / ITEM_PER_PAGE)
            });
        }).catch(err => {
            console.log(err)
        });
}

exports.getProduct = (req, res, next) => {
    const prodId = req.params.productId;
    Product.findById(prodId).then(product => {
        // console.log(product)
        res.render('shop/product-detail', {
            product: product,
            pageTitle: product.title,
            path: '/products',
        })
    }).catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
    })
}

exports.getIndex = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;

    Product.find().countDocuments().then(numProducts => {
        totalItems = numProducts;
        return Product.find()
            .skip((page - 1) * ITEM_PER_PAGE)
            .limit(ITEM_PER_PAGE)
    })
        .then(products => {
            res.render('shop/index', {
                prods: products,
                pageTitle: 'Shop',
                path: '/',
                csrfToken: req.csrfToken(),
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

exports.getCart = (req, res, next) => {
    req.user.populate({ path: 'cart.items.productId' })
        .then(products => {
            res.render('shop/cart',
                {
                    path: '/cart',
                    pageTitle: 'Your Cart',
                    products: products.cart.items,
                })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })

}

exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then(product => {
            return req.user.addToCart(product)
        }).then(result => {
            res.redirect('/cart')
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })

}

exports.getOrders = (req, res, next) => {
    Order.find({ "user.userId": req.user._id })
        .then(orders => {
            res.render('shop/orders', {
                path: '/orders',
                pageTitle: 'Your orders',
                csrfToken: req.csrfToken(),
                orders: orders,
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.postOrders = (req, res, next) => {

    req.user
        .populate({ path: 'cart.items.productId' })
        .then(user => {

            const products = user.cart.items.map(i => {
                return { quantity: i.quantity, product: { ...i.productId._doc } }
            })
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user._id
                },
                products: products
            })
            return order.save()
        })
        .then(() => {
            return req.user.clearCart();
        }
        ).then(() => {
            console.log('Order Created!')
            res.redirect('https://buy.stripe.com/test_28o9Cle7y4sZ7Uk5kk')
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })

}

exports.getCheckout = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .then(user => {
            const products = user.cart.items;
            let total = 0;
            products.forEach(p => {
                total += p.quantity * p.productId.price;
            })
            res.render('shop/checkout', {
                path: '/checkout',
                pageTitle: 'Checkout',
                products: products,
                totalSum: total
            });
        })
        .catch(err => {
            console.log('Currnetly we are not accepting payment due to security reasons!')
        });
};



exports.postCartDeleteProduct = (req, res, next) => {
    const productId = req.body.id;
    req.user.deleteItemFromCart(productId)
        .then(result => {
            res.redirect('/cart')
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
}

exports.getInvoice = (req, res, next) => {
    const orderId = req.params.orderId;
    Order.findById(orderId)
        .then(order => {
            if (!order) {
                return next(new Error('No order found.'));
            }
            if (order.user.userId.toString() !== req.user._id.toString()) {
                return next(new Error('Unauthorized'));
            }
            const invoiceName = 'invoice-' + orderId + '.pdf';
            const invoicePath = path.join('inputs', 'invoices', invoiceName);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                'inline; filename="' + invoiceName + '"'
            );

            const pdfDoc = new PDFDocument();
            pdfDoc.pipe(fs.createWriteStream(invoicePath));
            pdfDoc.pipe(res);
            pdfDoc.fontSize(26).text("Invoice", {
                underline: true
            })
            pdfDoc.text("----------------------");
            let totalPrice = 0;
            order.products.forEach(prod => {
                totalPrice += prod.quantity * prod.product.price
                pdfDoc.fontSize(14).text(prod.product.title + '  -  ' + prod.quantity + ' x ' + '$' + prod.product.price)
            });
            pdfDoc.text("----------------------");

            pdfDoc.fontSize(20).text("Total Price: $" + totalPrice)

            pdfDoc.end()
            // fs.readFile(invoicePath, (err, data) => {
            //     if (err) {
            //         return next(err);
            //     }
            //     res.setHeader('Content-Type', 'application/pdf');
            //     res.setHeader(
            //         'Content-Disposition',
            //         'inline; filename="' + invoiceName + '"'
            //     );
            //     res.send(data);
            // });
            // const file = fs.createReadStream(invoicePath);
            // file.pipe(res)
        })
        .catch(err => next(err));
};
