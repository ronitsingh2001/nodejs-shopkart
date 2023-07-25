const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const User = require('../models/user');

const accountSid = 'AC5beab56d088f42e0e8cf3e933ce392b8';
const authToken = '34154ce2b18dd7a8e9f99f75b78798b6';
const client = require('twilio')(accountSid, authToken);

const { validationResult } = require('express-validator')



exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0]
  } else {
    message = null
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    oldInput: {
      email: "",
      password: ''
    },
    validationError: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  // console.log(message)
  if (message.length > 0) {
    message = message[0]
  } else {
    message = null
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: "",
      password: "",
      confirmPassword: ""
    },
    validationError: []

  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password
      },
      validationError: errors.array()
    });
  }

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'This E-mail doesnot exists!',
          oldInput: {
            email: email,
            password: password
          },
          validationError: [{ path: 'email' }]
        });
      }
      bcryptjs.compare(password, user.password)
        .then(result => {
          if (result) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err)
              res.redirect('/')
            })
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Incorrect Password!',
            oldInput: {
              email: email,
              password: password
            },
            validationError: [{ path: 'password' }]
          });
        })
        .catch(err => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        })
    })
    .catch(err => console.log(err))
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const phone = req.body.phone;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array())
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword,
        phone: phone
      },
      validationError: errors.array()
    });
  }

  return bcryptjs
    .hash(password, 12)
    .then(hashedPass => {
      const user = new User({
        email: email,
        password: hashedPass,
        phone: phone,
        cart: { items: [] }
      })
      return user.save()
    }).then(() => {
      res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: null,
        oldInput: {
          email: email,
          password: ''
        },
        validationError: []
      });
      return client.messages
        .create({
          body: 'Signup Successfully',
          from: '+19894479393',
          to: `+91${phone}`
        })
        .then(message => console.log(message.sid))
      // .done();
      // transporter.sendMail({
      //   to: email,
      //   from: 'ronit2001krish@gmail.com',
      //   subject: 'SignUp Successfully!',
      //   html: '<h1>You Have Successfully Signed Up!!</h1>'
      // })
    }).catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    })
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error');
  // console.log(message)
  if (message.length > 0) {
    message = message[0]
  } else {
    message = null
  }

  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: message
  })
}

exports.postReset = (req, res, next) => {

  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err)
      return res.redirect('/reset')
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        if (!user) {
          req.flash('error', 'No Account with that email found!');
          return res.redirect('/reset');
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        user.save().then(result => {
          return client.messages
            .create({
              body: `
                You have requested a password reset. To set a new password click on - http://localhost:3000/reset/${token}
              `,
              from: '+19894479393',
              to: `+91${user.phone}`
            })
            .then(message => console.log(message.sid))
          // transporter.sendMail({
          //   from: 'ronit2001krish@gmail.com',
          //   to: req.body.email,
          //   subject: 'Password Reset!',
          //   html: `
          //   <p>You Have Requested a password reset.</p>
          //   <p>Click this <a href="http://localhost:3000/reset/${token}">Link</a> to set a new password!!</p>
          //   `
          // })
        }).then(() => {
          res.render('response', {
            pageTitle: 'Response Page', path: '/response',
            isAuthenticated: req.session.isLoggedIn,
            message: "A SMS to registered mobile number has been sent successfully to update password."

          })
        })
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      })
  })
}

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then(user => {
      let message = req.flash('error');
      // console.log(message)
      if (message.length > 0) {
        message = message[0]
      } else {
        message = null
      }

      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        userId: user._id.toString(),
        token: token
      })
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    })
}

exports.postNewPassword = (req, res, next) => {
  const NewPassword = req.body.password;
  const userId = req.body.userId;
  const token = req.body.token;
  let resetUser;
  User.findOne({
    _id: userId,
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() }
  })
    .then(user => {
      resetUser = user
      return bcryptjs.hash(NewPassword, 12)
    })
    .then(hashedPass => {
      resetUser.password = hashedPass;
      resetUser.resetToken = null;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save()
    })
    .then(() => {
      console.log(resetUser)
      console.log('successfully updated')
      client.messages
        .create({
          body: 'Password updated Successfully',
          from: '+19894479393',
          to: `+91${resetUser.phone}`
        })
        .then(message => console.log(message.sid))
      res.redirect('/login')
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    })
}