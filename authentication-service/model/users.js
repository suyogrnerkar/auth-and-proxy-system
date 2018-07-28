// User Model
const USERS = 'users';

const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;

function Users(db) {
  this.db = db;
  this.users = db.collection(USERS);
}

// Create new User with body JSON, id can be anything
Users.prototype.newUser = function(id, body, pwd_hash) {
  return this.users.insertOne({ id: id, body: body, password: pwd_hash }).
    then(function(results) {
      return new Promise((resolve) => resolve(results.ops));      
    });
}

// get User if exists
Users.prototype.getUser = function(id) {
  const searchSpec = { id: id };
  return this.users.find(searchSpec).toArray().
    then(function(users) {
      return new Promise(function(resolve, reject) {
        if (users.length === 1) {
          resolve(users[0]);
        }
        else {
          reject(new Error(`cannot find user ${id}`));
        }
      });
    });
}

// delete User if exists
Users.prototype.deleteUser = function(id) {
  return this.users.deleteOne({ id: id }).
    then(function(results) {
      return new Promise(function(resolve, reject) {
        if (results.deletedCount === 1) {
          resolve();
        }
        else {
          reject(new Error(`cannot delete user ${id}`));
        }
      });
    });
}


module.exports = {
  Users: Users,
};
