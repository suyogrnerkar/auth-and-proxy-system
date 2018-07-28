const https = require('https');
const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
var session = require('client-sessions');
const axios_lib = require('axios');
const axios = axios_lib.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const SEE_OTHER = 303;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

const SECRET = "kfnhjnmdmnnjdj8y4b6nbsgjflanvbh";

// App bindings to create a server listening on specified port 
function serve(opts) {
  const app = express();
  app.set('view engine', 'pug');
  app.locals.sslDir = opts.sslDir;
  app.locals.port = opts.port;
  app.locals.wsUrl = opts.wsUrl;
  app.use(session({
    cookieName: 'session',
    secret: SECRET,
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
  }));

  setupRoutes(app);
  console.log(`\nOPTIONS    :- ${JSON.stringify(opts)}`);
  
  let creds = {
    key: fs.readFileSync(path.resolve(opts.sslDir + '/key.pem')),
    cert: fs.readFileSync(path.resolve(opts.sslDir + '/cert.pem'))
  };

  https.createServer(creds, app).listen(opts.port, function() {
    console.log(`SERVER UP  :- Listening on port ${opts.port}\n`);
  });
}

// Router bindings
function setupRoutes(app) {
  app.use('/', bodyParser.urlencoded({ extended: true }));

  app.get('/', showAccount(app));
  app.get('/account', showAccount(app));
  app.get('/signup', showSignUp(app));
  app.get('/logout', logout(app));
  
  app.post('/', createSession(app));
  app.post('/signup', newUser(app));
  app.get('*', function(req, res){
    res.send('No such route !!!', 404);
  });
}

// requestURL
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl.split("?").shift()}`;
}
  
// Exports serve from this module as serve
module.exports = {
  serve: serve
}

// Utility CRUD Controllers
function logout(app) {
  return function(request, response) {
    request.session.reset();
    response.redirect('/account');
  };
}

function showSignUp(app) {
  return function(request, response) {
    if (request.session && request.session.user && request.session.token) {
      response.redirect('/account');
    } else{
      response.render('signup', { title: 'Signup Page'});
    }
  };
}

function showAccount(app) {
  return function(request, response) {
    if (request.session && request.session.user && request.session.token) { 
      axios
        .get(`${request.app.locals.wsUrl}/users/${request.session.user}`,
            { headers: { "Authorization" : `Bearer ${request.session.token}` }
          })
        .then(function (res) {
          response.render('account', { title: 'Accounts Page', 
            msg: { 
              status: "SUCCESS",
              txt: "LOGGED IN",
              firstName: res.data.firstName, 
              lastName: res.data.lastName
            }
          });
        })
        .catch(function (error) {
          console.log(error);
          request.session.reset();
          response.render('login', { title: 'Login Page', msg: {
            status: 'ERROR',
            txt: 'Web Service Token Expired, Session Terminated. Login Again.'
          }});
        });
    } 
    else {
      response.render('login', { title: 'Login Page'});
    } 
  };
}

/* Authorize user : PUT /users/ID/auth
 * - checks: 
 *   - 200 : if token generated for valid user
 *   - 400 : if body is not JSON object.
 *   - 401 : if the unauthorized request received.
 *   - 404 : if resource not found.
 *   - 500 : on server error
 */ 
function createSession(app) {
  return function(request, response) { 

    if(!request.body.email) {
      response.render('login', { 
        title: 'Login Page',
        msg: { status: 'ERROR', txt: "( Email field cannot be empty. )" } 
      });
    }
    else if(!request.body.password) {
      response.render('login', { 
        title: 'Login Page',
        msg: { status: 'ERROR', txt: "( Password field cannot be empty. )", email: request.body.email } 
      });
    } 
    else {
      let regex = /^([\w\-\.]+)@((\[([0-9]{1,3}\.){3}[0-9]{1,3}\])|(([\w\-]+\.)+)([a-zA-Z]{2,4}))$/i;
      if (!request.body.email.trim().match(regex)) {
        response.render('login', { 
          title: 'Login Page',
          msg: { status: 'ERROR', txt: "( Not a valid email. )", email: request.body.email.trim() } 
        });
      }
      else {
        data = { pw: request.body.password }
        axios
          .put(`${request.app.locals.wsUrl}/users/${request.body.email.trim()}/auth`, 
                  data, { maxRedirects: 0 })
          .then((res) => {
            console.log(res.data);
            // 200 : if token generated for valid user
            if(res.status == 200) {
              console.log(res);
              request.session.user = request.body.email.trim();
              request.session.token = res.data.authToken;
              response.redirect('/account');
            }
          })
          .catch(function (error) {
            console.log(error);
            if(error.response) {
              // 401 : if the unauthorized request received.
              if(error.response.status == "401") {
                response.render('login', { 
                  title: 'Login Page',
                  msg: { 
                    status: 'ERROR', 
                    txt: error.response.data.status + " ( Please Login with valid credentials. )",
                    email: request.body.email
                  } 
                });
              }
              // 404 : if resource not found.
              else if (error.response.status == "404") {
                response.render('signup', { 
                  title: 'Signup Page',
                  msg: { 
                    status: 'ERROR', 
                    txt: error.response.data.status + " ( User not found. Signup. )",
                    email: request.body.email
                  } 
                });
              }
            }
            // 500 : on server error
            else {
              response.render('login', { 
                title: 'Login Page',
                msg: { 
                  status: 'ERROR',
                  txt: "Web Service Error..",
                  email: request.body.email
                } 
              });
            }
          });
        };
      }
    }
}

/* Create user : PUT /users/ID?pw=PASSWORD
 * - checks: 
 *   - 201 : if new user created
 *   - 303 : if user found
 *   - 400 : if body is not JSON object.
 *   - 500 : on server error
 */ 
function newUser(app) {
  return function(request, response) {
    console.log(request);
    let regex = /^([\w\-\.]+)@((\[([0-9]{1,3}\.){3}[0-9]{1,3}\])|(([\w\-]+\.)+)([a-zA-Z]{2,4}))$/i;
    // Validate Email presence
    if(!request.body.email) {
      response.render('signup', { 
        title: 'Signup Page',
        msg: { 
          status: 'ERROR', 
          txt: "( Email field cannot be empty. )", 
          email: request.body.email, 
          firstName: request.body.firstName ? request.body.firstName : "",
          lastName: request.body.lastName ? request.body.lastName : ""
        } 
      });
    }
    // Validate Email pattern
    else if (!request.body.email.trim().match(regex)) {
      response.render('signup', { 
        title: 'Signup Page',
        msg: { 
        status: 'ERROR', 
        txt: "( Not a valid email. )", 
        email: request.body.email, 
        firstName: request.body.firstName ? request.body.firstName : "",
        lastName: request.body.lastName ? request.body.lastName : ""
        } 
      });
    }
    // Validate Password
    else if(!request.body.password || !request.body.confirmPassword) {
      response.render('signup', { 
        title: 'Signup Page',
        msg: { 
          status: 'ERROR', 
          txt: "( Password fields cannot be empty. )", 
          email: request.body.email,
          firstName: request.body.firstName ? request.body.firstName : "",
          lastName: request.body.lastName ? request.body.lastName : ""
        } 
      });
    } 
    // Validate First and Last Name
    else if(!request.body.firstName || !request.body.lastName || 
            request.body.firstName.trim() == '' || request.body.lastName.trim() == '') {
      let errorMsg;

      if(!request.body.firstName || request.body.firstName.trim() == '') {
        errorMsg = "First Name cannot be empty"
      }
      if(!request.body.lastName || request.body.lastName.trim() == '') {
        errorMsg = "Last Name cannot be empty"
      }
      response.render('signup', { 
        title: 'Signup Page',
        msg: { 
          status: 'ERROR', txt: errorMsg, 
          email: request.body.email, 
          firstName: request.body.firstName ? request.body.firstName : "",
          lastName: request.body.lastName ? request.body.lastName : ""
        } 
      });
    }
    // Valid entry check for password conditions
    else {
      data = { firstName: request.body.firstName.trim(), lastName: request.body.lastName.trim() }
      // validate passwords match
      if(request.body.password != request.body.confirmPassword) {
        response.render('signup', { 
          title: 'Signup Page',
          msg: { 
            status: 'ERROR',
            txt: "Password and Confirm Password should match.",
            email: request.body.email,
            firstName: request.body.firstName ? request.body.firstName : "",
            lastName: request.body.lastName ? request.body.lastName : ""
          } 
        });
      }
      // validate password: 
      // at least 8 characters none of which is 
      // a whitespace character and at least one of which is a digit
      else if(request.body.password.length < 8 || 
              request.body.password.indexOf(' ') >= 0 ||
              !request.body.password.match(/\d/)) 
      {
        response.render('signup', { 
          title: 'Signup Page',
          msg: { 
            status: 'ERROR',
            txt: "Need atleast 8 characters in password, no spaces & atleast one digit",
            email: request.body.email,
            firstName: request.body.firstName ? request.body.firstName : "",
            lastName: request.body.lastName ? request.body.lastName : ""
          } 
        });
      }
      // valid entry, create account
      else {
        axios
          .put(`${request.app.locals.wsUrl}/users/${request.body.email.trim()}/?pw=${request.body.password}`, 
               data, { maxRedirects: 0 })
          // On create, login and setup session 
          .then((res) => {
            request.session.user = request.body.email.trim();
            request.session.token = res.data.authToken;
            response.redirect('/account');
          })
          // Error, user already exists or webservice failed
          .catch(function (error) {
            console.log(error);
            if(error.response) {
              // 303 : if user found
              if(error.response.status == 303) {
                response.render('login', { 
                  title: 'Login Page',
                  msg: { 
                    status: 'ERROR',
                    txt: error.response.data.status + " ( " + error.response.data.info + " ), Please Login.",
                    email: request.body.email
                  } 
                });
              }
            }
            // 500 : on server error
            else {
              response.render('signup', { 
                title: 'Signup Page',
                msg: { 
                  status: 'ERROR',
                  txt: "Web Service Error..",
                  email: request.body.email,
                  firstName: request.body.firstName ? request.body.firstName : "",
                  lastName: request.body.lastName ? request.body.lastName : ""
                } 
              });
            }
          });
      }
    }
  };
}






