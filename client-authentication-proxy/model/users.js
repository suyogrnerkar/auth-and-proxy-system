// User Model
const USERS = 'users';

const assert = require('assert');

function Users(wsUrl) {
  this.wsUrl = wsUrl;
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

module.exports = {
  Users: Users,
};
