var db = require('./dbConfig');
var User = require('../models/users');
var BuddyRequest = require('../models/buddyRequest');
var Message = require('../models/messages');
var Rating = require('../models/Ratings');
var Conversation = require('../models/conversations');
var sessionHandler = require('./session-handler');

var where = require('node-where');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var transporter = nodemailer.createTransport(smtpTransport({
  service: 'Gmail',
  auth: {
    user: process.env.gmailUser,
    pass: process.env.gmailPass
  }
}));

exports.getIndex = function(req, res) {
  //https://stackoverflow.com/questions/6096492/node-js-and-express-session-handling-back-button-problem
  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
  if (req.session ? !!req.session.user : false) {
    console.log('user exists in session. logging in.');
    // console.log('session: ',req.session)
    res.render('index');
  } else {
    console.log('user does not exist in session(line 14), redirecting to login. ');
    res.redirect('/login');
  }
};

exports.getTest = function(req, res) {
  res.render('index');
};


exports.getUser = function(req, res) {
  // console.log('REQ SESSION', req.session.user.username)
  res.json(req.session.user.username);
};

exports.getAllUsers = function(req, res) {
  // TODO
  User.find({}, 'username', function (err, usernames) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(usernames);
    }
  });
};

exports.getFriends = function(req, res) {
  User.findOne({username: req.session.user.username}, 'friends', function(err, friends) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(friends);
    }
  });
};

const sendBuddyEmailNotification = (currUsername, friendUsername) => {
  User.findOne({username: friendUsername}, 'email friends', (err, friendUser) => {
    if (err) {
      console.error(err);
    } else {
      return friendUser;
    }
  }).then(friendUser => {
    let message = friendUser.friends.includes(currUsername)
      ? `${currUsername} added you back on findabuddy! Look forward to some fun times with your new buddy.`
      : `${currUsername} added you as a buddy! Feel free to add them back so it's easier to chat on findabuddy.`;

    !friendUser.email ? null : transporter.sendMail({
      from: process.env.gmailUser,
      to: friendUser.email,
      subject: `${currUsername} buddied you on findabuddy!`,
      html: `
        <img src="http://res.cloudinary.com/chobi/image/upload/v1499673697/findabuddy_icon2_orange_p5hu5l.png"/>
        <h3>Hey ${friendUsername}!</h3>
        <p>${message}</h3>
      `,
      text: `Hey ${friendUsername}!\n${message}`
    });
  });
};

/*
  Accepts friend's username
  Adds to the current user's friends list
  Sends back the updated friendlist
*/
exports.addFriend = function (req, res) {
  const currUsername = req.session.user.username;
  const friendUsername = req.body.username;

  User.findOneAndUpdate({ username: currUsername },
    { $push: { friends: friendUsername } },
    { new: true },
    (err, currUser) => {
      res.json(currUser.friends);
      sendBuddyEmailNotification(currUsername, friendUsername);
    }
  );
};

exports.getProfile = function(req, res) {
  var username = req.session.user.username;
  User.find({username: username}, function(err, data) {
    if (err) {
      res.status(500).send(err);
    }
    var profileInfo = {
      username: data[0].username,
      bio: data[0].bio,
      bioTitle: data[0].bioTitle,
      interests: data[0].interests
    };
    // console.log('DATA USER', data)
    res.status(200).send(profileInfo);
  });
};

exports.getBuddyProfile = function(req, res) {
  // Todo: use currentUserName to check if buddyName is in his buddyList
  var currentUserName = req.session.user.username;
  var buddyName = req.params.buddyName;

  User.findOne({username: buddyName}, function(err, data) {
    if (err) {
      console.log('Error getting buddy profile', err);
      res.status(500).send('An error occured.');
    } else if(!data) {
      console.log('Buddy not found', err);
      res.status(404).send('Buddy not found.');
    } else {
      var profileInfo = {
        username: data.username,
        bio: data.bio,
        bioTitle: data.bioTitle,
        interests: data.interests,
        friends: data.friends
      };
      // console.log('DATA USER', data)
      res.status(200).send(profileInfo);
    }
  });
};


exports.postProfile = function(req, res) {
  var username = req.body.username;

  //console.log('USRNAME', req.body);

  User.findOne({username: username}, function(err, profile) {

    if (err) {
      res.status(500).send(err);
    }
    profile.bio = req.body.bio || profile.bio;
    profile.bioTitle = req.body.bioTitle || profile.bioTitle;
    profile.save(function (err, profile) {
      if (err) {
        res.status(500).send(err);
      }

      console.log('updated profile in DB', profile );
      res.send(profile);
    });
  });
};


exports.getInterests = function(req, res) {
  User.findOne({username: req.session.user.username}, 'interests', function(err, interests) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json(interests);
    }
  });
};


exports.addInterest = function (req, res) {
  // console.log('body', req.body);
  // console.log('params', req.params);
  // res.send('hello');
  // return;
  const currUsername = req.session.user.username;
  const interest = req.body.interest;

  User.findOneAndUpdate({ username: currUsername },
    { $push: { interests: interest } },
    { new: true },
    (err, currUser) => {
      res.json(currUser.interests);
    }
  );
};

exports.getLogin = function(req, res) {
  res.render('login');
};

exports.postLogin = function(req, res) {

  //console.log('login post, req.body', req.body);
  var username = req.body.username;
  var password = req.body.password;

  User.findOne({username: username}, function(err, user) {
    if (err) {
      sessionHandler.error(err);
    } else if (!user) {
      console.log('Please sign in');
      sessionHandler.delete(req, res, '/signup');
    } else {
      //check if password matches the username, if so error
      if (password === username) {
        console.log('Password should not match username');
        res.redirect('/login');
      //if not, make new session and return and redirects to index
      } else if (password === user.password) {
        console.log('user is cool: ', user);
        sessionHandler.regenerate(req, res, user);
      } else {
        console.log('Incorrect username or password');
        res.redirect('/login');
      }
    }
  });
};

exports.getLogout = function(req, res) {
  sessionHandler.delete(req, res, '/login');
};


exports.getSignup = function(req, res) {
  res.status(200);
  res.render('signup');
};

const sendWelcomeEmail = (username, email) => {
  transporter.sendMail({
    from: process.env.gmailUser,
    to: email,
    subject: 'Welcome to findabuddy!',
    html: `
      <img src="http://res.cloudinary.com/chobi/image/upload/v1499673697/findabuddy_icon2_orange_p5hu5l.png"/>
      <h3>Welcome ${username}!</h3>
      <p>Thanks for signing up on findabuddy!</p>
    `,
    text: `Welcome ${username}!\nThanks for signing up on findabuddy!`
  });
};

exports.postSignup = function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;
  var newUser = {
    username: username,
    password: password,
    email: req.body.email,
    gender: req.body.gender,
    age: req.body.age,
    zipCode: req.body.zipCode,
    interests: req.body.interests,
    requestHistory: req.body.requestHistory
  };

  //check if user exists
  User.findOne({username: username.toLowerCase()}, function(err, user) {
    if (err) {
      sessionHandler.error(err);
    //if so, error
    } else if (user) {
      console.log('Username already in use');
      res.redirect('/signup');
    } else {
      //check if password matches the username, if so error
      if (password === username) {
        console.log('Password should not match username');
        //res.redirect('/signup');
        res.render('signup');
      //if not, make new session and return and redirects to index
      } else if (password === '') {
        console.log('Password should not be an empty string');
        res.redirect('/signup');
      } else {
        new User(newUser).save(function(err, user) {
          if (err) {
            sessionHandler.error(err);
          } else if (!user) {
            sessionHandler.error('Database Error');
          } else {
            sessionHandler.regenerate(req, res, user);
            !email ? null : sendWelcomeEmail(username, email);
          }
        });
      }
    }
  });
};

exports.getSingleBuddyRequest = function (req, res) {

};

exports.getBuddyRequest = function(req, res) {
  //http://www.zipcodeapi.com/API#distance
  // 50 api requests per hour
  //console.log(req.body, req.query, typeof req.query.age);
  var query = BuddyRequest;
  /*
  {age: {'$lte': 30, '$gte': 20},
   activityNoun: 'Golf',
  }
   */
  //console.log('req.query: ', req.query);

  if (typeof req.query.age === 'string') {
    var parsed = JSON.parse(req.query.age);
    delete req.query.age;
    var keys = Object.keys(parsed);
    keys.map(function(cur) {
      var params = ['$gte', '$lte', '$lt', '$gt'];
      params.map(function(curParam) {
        if (cur === curParam) {
          console.log('key is ', cur, parsed[cur], typeof parsed[cur]);
          var trimmedCur = cur.slice(1);
          query = query.where('age')[trimmedCur](parsed[cur]);
        }
      });
    });
  }
  var keys = Object.keys(req.query);
  keys.map(function(curKey) {
    if (req.query[curKey] === '') {
      delete req.query[curKey];
    }
    if (curKey === 'age' && req.query[curKey]['$gte'] === '' && req.query[curKey]['$lte'] === '') {
      delete req.query[curKey];
    }
    if (curKey === 'gender' && req.query[curKey] === 'No Preference') {
      delete req.query[curKey];
    }
  });
  //console.log('sanitized query: ', req.query);
  query = query.find(req.query);
  query.exec(function(err, results) {
    if (err) { console.error(err); }
    //console.log(err, results);
    res.status(200).send(results);
  });
/*
    // {name: 'alex', zipcode: '{$gte: 90000}'}
    req.query.zipcode = JSON.parse(req.query.zipcode);
    delete req.query.zipcode
    console.log(req.query);
  } else {
    var query = BuddyRequest.find(req.query);
  }
  var promise = query.exec();
  promise.addBack(function (err, docs) {
    if (err) { console.error(err); }
    //console.log(docs);
    res.status(200).send(docs);
  });
  */

};

exports.postBuddyRequest = function(req, res) {
  //console.log('request body: ',req.body);
  where.is(`${req.body.city} ${req.body.country}`, function(err, result) {
    if(!err){
      req.body.lat = result.get('lat');
      req.body.lng = result.get('lng');
    }

    new BuddyRequest(req.body).save() /*eslint-disable indent*/
    .then(function(err, buddyRequest) {
      req.io.emit('new-request');
      res.status(201).send();
    })
    .catch(function(err) {
      console.error(err);
    });
  });
}; /*eslint-enable indent*/


exports.getCurrentUserAllBuddyRequests = function(req, res) {
  var curUser = req.session.user.username;
  BuddyRequest.find({user: curUser}, function (err, requests) {
    if(err) {
      console.log('Error in getCurrentUserAllBuddyRequests: ', err);
      res.status(500).send("Sorry, there are errors on our server");
    } else {
      console.log('requests', requests);
      res.json(requests);
    }
  });
}


exports.getMessages = function(req, res) {
  //console.log('Get Messages request body: ', req.body);

  Conversation.find({ participants: req.session.user.username }).populate('messages').exec(function(err, convos){
    res.json(convos);
  });
  // Message.find({}, function(err, messages) {
  //   if (err) {
  //     res.status(500).send(err);
  //   } else {
  //     //console.log('Messages', messages);
  //     res.status(200).send(messages.reverse());
  //   }
  // });
};

exports.getMessagesByRecipient = function(req, res) {
  // console.log('Get Messages request param:', req.query);
  var query = {
      participants: {
        $all: [req.session.user.username, req.query.recipient]
      }
    };

  Conversation.findOne(query).populate('messages').exec(function(err, convos){
    res.json(convos);
  });
  // var user = req.query.recipient;
  // //console.log('Get Messages per recipient ', user);
  // Message.find({'recipient': user}, function(err, messages) {
  //   if (err) {
  //     res.status(500).send(err);
  //   } else {
  //     res.status(200).send(messages.reverse());
  //   }
  // });
};


exports.postMessage = function(req, res) {
  let currUsername = req.session.user.username;
  let recipientUsername = req.body.recipient;

  // find-a-buddy-bot will respond with a different message depending on whether or not the users have already buddied each other or not
  let botText;
  let recipientFriends;

  // get recipient's friends
  User.findOne({username: recipientUsername}, 'friends', (err, recFriends) => {
    if (err) {
      console.log('failed to get recipient friends');
    } else {
      return recFriends.friends;
    }
  }).then(recFriends => {
    // recipient is not yet friends with current user
    return !(recFriends.friends.includes(currUsername))
      ? `FYI, ${currUsername} added you as a buddy. Feel free to add them back so it's easier to chat.`
      // else, recipient is already friends with current user
      : `${currUsername} added you back! Look forward to some fun times with your new buddy.`;
  }).catch(() => {
    return 'Start of buddy chat';
  }).then(botText => {

    //check if there is a conversation with sender and recipient, if yes
    var message = new Message({
      // logic for adding a friend you haven't chatted w/ yet (avoids an error), also sends bot text the first time someone sends a message to a friend
      sender: !req.body.justAdded ? req.session.user.username : 'find-a-buddy-bot',
      text: !req.body.justAdded ? req.body.text : botText,
      date: new Date(),
      read: false
    });

    message.save(function(err, message) {
      console.log('sender', message.sender);
      console.log(req.session.user.username);
      console.log(req.body.recipient);

      var query = {
        participants: {
          $all: [req.session.user.username, req.body.recipient]
        }
      };

      Conversation.findOne(query).populate('messages').exec(function(err, convo) {
        if (!convo) {
          var convo = new Conversation();
          convo.participants = [req.session.user.username, req.body.recipient];
          convo.messages.push(message);
          convo.save(function(err, newConvo) {
            newConvo.participants.forEach(function(username) {
              console.log('sending message to ', username);
              req.io.sockets.to(username).emit('message', newConvo);
            });
            res.json(newConvo);
          });
        } else {
          convo.messages.push(message);
          convo.save(function(err, updatedConvo) {

            updatedConvo.participants.forEach(function(username) {
              console.log('sending message to ', username);
              req.io.sockets.in(username).emit('message', updatedConvo);
            });
            res.json(convo);

          });
        }
      });

    });

    //create message and push to messages
  // else
    //create new conversation and push messages to conversation
  //end


  // var newMessage = {
  //   recipient: req.body.recipient,
  //   sender: req.body.sender,
  //   message: req.body.message,
  // };

  // new Message(newMessage).save() eslint-disable indent
  // .then(
  //   function() {
  //     res.status(201).send();
  //   }
  // )
  // .catch(
  //   function(err) {
  //     console.error(err);
  //   }
  // );
  });
}; /*eslint-enable indent*/

exports.putMessageByRecipient = function(req, res) {
  var user = req.body.recipient;

  //console.log('user', user);
  Message.find({'recipient': user}, function(err, messages) {
    if (err) {
      res.status(500).send(err);
    } else {
      messages.forEach(function(message) {
        message.read = true;
        message.save(function (err, todo) {
          if (err) {
            res.status(500).send(err);
          } else {
            res.status(200).send();
          }
        });
      });
    }
  });
};

exports.toggleRead = function(req, res) {
  Conversation.findById(req.params.id)
              .exec((err, conversation) => {
                console.log("conversation", conversation)
                conversation.messages.forEach((messageid) => {
                  Message.findOneAndUpdate({_id: messageid}, {read:true}, {new: true}, (err, message) => {
                    console.log("error", err)
                    console.log("message", message)
                  })
                })
                res.sendStatus(201)
              })
}

//adding filtering logic
var getRating = function(buddyRequestId, username, callback) {
  var searchObj = {};

  if (buddyRequestId) {
    searchObj.buddyRequestId = buddyRequestId;
  } else if (username) {
    searchObj.username = username;
  }

  Rating.find(searchObj).exec(function(err, ratings) {
    callback(ratings);
  });
};

//keep, but not exposed
var getUserAverageRating = function(username) {
  /*
    TODO: change to averaging results from 'Results' table
  User.findOne({user})
  .exec(function(err, user) {
    if (user) {
      ratings = user.ratings.reduce(function(acc, rating) {
        return acc + parseInt(rating, 10);
      }, 0);
      ratings = (ratings / user.ratings.length).toFixed(1);
      res.status(200).send(ratings);
    } else {
      res.send('failed to retrieve rating')
    }
  });
  */
};

exports.updateRating = function(req, res) {
  // TODO: implement me
};

exports.getRequestRatings = function(req, res) {
  //console.log('getting ratings for BRId: ', req.params.request_id);
  Rating.find({BuddyRequestId: req.params.request_id}, function(err, results) {
    if (err) { console.error(err); }
    res.status(200).send(results);
  });

};

exports.postRating = function(req, res) {
  var newRating = {
    reviewer: req.body.reviewer,
    reviewee: req.body.reviewee,
    buddyRequestId: req.body.buddyRequestId,
    rating: req.body.rating,
    reviewText: req.body.reviewText
  };

  //console.log('req session id: ', req.session);

  new Rating(newRating).save() /*eslint-disable indent*/
  .then(
    function() {
      res.status(201).send();
    }
  )
  .catch(
    function(err) {
      console.error(err);
    }
  );
}; /*eslint-enable indent*/

exports.get404 = function(req, res) {
  res.status(404);
  res.send();
};



/*
Fully functional (to our knowledge) routing handlers
 exports.getIndex

 exports.getTest
    deprecated test rendering before login was implemented

 exports.getProfile

 exports.postProfile
      TODO: all login/logout/signup endpoints need more extensive testing
 exports.getLogin

 exports.postLogin

 exports.getLogout

 exports.getSignup

 exports.postSignup

 exports.getBuddyRequest

 exports.getMessages
   deprecated, use below function instead

 exports.getMessagesByRecipient

 exports.postMessage

 exports.putMessageByRecipient



 exports.updateRating = function(req,res) {
   TODO: implement me

 exports.getRequestRatings = function(req,res)

 exports.postRating = function(req, res)
   TODO: implement front end to call this function

 exports.get404 = function(req,res)

 ------------------------------------------------------
 ------------------------------------------------------
          Patially functional routing functions
 ------------------------------------------------------
 ------------------------------------------------------
 exports.getUser

 exports.getSingleBuddyRequest
   TODO: implement for purposes of having external URLs to reference BuddyRequests by object id,
   ie: http://findabuddy.herokuapp.com/request/1237ad79c9a9

 exports.postBuddyRequest
   various combinations of defaults can break this function, needs testing


 var getUserAverageRating
    stubbed out, not implemented yet, one of the features to add to user profile in the future
 */
