const users = require('./users');

function Model(wsUrl) {
  this.users = new users.Users(wsUrl);
}

module.exports = {
  Model: Model
};
