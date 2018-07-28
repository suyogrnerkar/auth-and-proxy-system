const https = require('https');
const fs = require('fs');
const path = require('path');

const bcrypt = require('bcrypt');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const SEE_OTHER = 303;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

const SECRET = "NOSECRETYET";

// App bindings to create a server listening on specified port 
function serve(opts, model) {
  const app = express();
  app.locals.model = model;
  app.locals.authTimeout = opts.authTimeout;
  app.locals.sslDir = opts.sslDir;
  app.locals.port = opts.port;

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
  app.use('/users/', bodyParser.json());
  app.put('/users/:id', newUser(app));
  app.put('/users/:id/auth', authUser(app));
  app.get('/users/:id', getUser(app));
  // NOTE: Commented out the delete route as this was only for 
  //       development purpose only
  // app.delete('/users/:id', deleteUser(app));
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

/* Create user : PUT /users/ID?pw=PASSWORD
 * - checks: 
 *   - 201 : if new user created
 *   - 303 : if user found
 *   - 400 : if body is not JSON object.
 *   - 500 : on server error
 */ 
function newUser(app) {
  return function(request, response) {
    const id = request.params.id;

    if (typeof id === 'undefined' || !Object.keys(request.body).length) {
      response.sendStatus(BAD_REQUEST);
    }
    else {
      request.app.locals.model.users.getUser(id).
        then(function(user) {
          console.log(`STATUS:- User ${user.id} already exists`);
          response.append('Location', requestUrl(request));
          response.status(SEE_OTHER);
          response.send({ 
            "status": "EXISTS",
            "info": `user ${user.id} already exists`
          });  
        }).
        catch((err) => {
          console.error("\nSTATUS:- User not found, Creating new user");
          bcrypt.hash(request.query.pw, 10, function(err, hash) {
            request.app.locals.model.users.newUser(request.params.id, request.body, hash).
              then(function(user) {
                let newToken = jwt.sign(
                  { user: user[0].id }, 
                  SECRET, 
                  { expiresIn: parseInt(app.locals.authTimeout) }
                );
                response.append('Location', requestUrl(request));
                response.status(CREATED);
                response.send({ 
                  "status": "CREATED",
                  "authToken": newToken
                });
              }).
              catch((err) => {
                console.error(err);
                response.sendStatus(SERVER_ERROR);
              });
            });
        });
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

function authUser(app) {
  return function(request, response) { 
    const id = request.params.id;
    if (typeof id === 'undefined' || !Object.keys(request.body).length) {
      response.sendStatus(BAD_REQUEST);
    }
    else { 
      request.app.locals.model.users.getUser(id).
        then(function(user) {
          bcrypt.compare(request.body.pw, user.password, function(err, res) {
            if(res) { 
              console.log(`AUTH STATUS:- User ${user.id}, Authorized`);
              let newToken = jwt.sign(
                { user: user.id }, 
                SECRET, 
                { expiresIn: parseInt(app.locals.authTimeout) }
              );
              response.append('Location', requestUrl(request));
              response.status(OK);
              response.send({ 
                "status": "OK",
                "authToken": newToken
              });
            }
            else { 
              console.log(`AUTH STATUS:- User ${user.id}, NOT Authorized`); 
              response.append('Location', requestUrl(request));
              response.status(UNAUTHORIZED);
              response.send({ 
                "status": "ERROR_UNAUTHORIZED",
                "info": `/users/${user.id}/auth requires a valid 'pw' password query parameter`
              });
            }
          }); 
        }).
        catch((err) => {
          console.error(err);
          response.status(NOT_FOUND);
          response.send({ 
            "status": "ERROR_NOT_FOUND",
            "info": `user ${id} not found`
          }); 
        });
    }
  };
}

/* get user : GET /users/ID
 * - checks: 
 *   - 200 : if user found with user data body
 *   - 400 : if body is not JSON object.
 *   - 401 : if token expired or invalid, also if no auth provided
 *   - 404 : if resource not found
 */
function getUser(app) {
  return function(request, response) {
    const id = request.params.id;
    if (typeof id === 'undefined') {
      response.sendStatus(BAD_REQUEST);
    }
    else {
      request.app.locals.model.users.getUser(id).
        then(function(user) {
          let auth = request.headers['authorization'];
          if(auth) {
            let token = auth.split(" ")[1];
            jwt.verify(token, SECRET, function(err, decoded) {
              if (err) {
                console.error('JWT        :- Verification Error', err);
                console.log(`GET STATUS :- User ${user.id}, NOT Authorized`); 
                response.append('Location', requestUrl(request));
                response.status(UNAUTHORIZED);
                response.send({ 
                  "status": "ERROR_UNAUTHORIZED",
                  "info": `/users/${user.id} requires a bearer authorization header`
                });
              }
              else { 
                console.log(`GET STATUS :- User ${user.id}, Authorized`);
                response.append('Location', requestUrl(request));
                response.status(OK);
                response.send(user.body);
             }
            }); 
          }
          else {
            response.status(UNAUTHORIZED);
            response.send({ 
              "status": "ERROR_UNAUTHORIZED",
              "info": `/users/${user.id} requires a bearer authorization header`
            });
          }
        }).
        catch((err) => {
          console.error(err);
          response.status(NOT_FOUND);
          response.send({ 
            "status": "ERROR_NOT_FOUND",
            "info": `user ${id} not found`
          }); 
        });
    }
  };
}


/* NOTE: Utility function for development purposes only 
 * Delete user : DELETE /users/ID
 * - checks: 
 *   - 200 : if user found & deleted
 *   - 404 : if not found.
 */
function deleteUser(app) {
  return function(request, response) {
    const id = request.params.id;
    if (typeof id === 'undefined') {
      response.sendStatus(BAD_REQUEST);
    }
    else {
      request.app.locals.model.users.deleteUser(id).
        then(function() { 
          console.log("STATUS:- Deleted user " + request.params.id);
          response.end();
        }).
        catch((err) => {
          console.error(err);
          response.sendStatus(NOT_FOUND);
        });
    }
  };
}


