# Sec-Angular-Express

[Node.js](https://nodejs.org) module to ease the development of a *secure* [Express](http://expressjs.com/)+[Angular.js](https://angularjs.org/) web application. Angular.js provides a couple of nice features that make developing a secure web application as easy as possible. This module tries to make good use of these features whith as much effort as possible.

##Quickstart
At the very least you need to do three things:
###1. Configure the module
In your main file:
```JavaScript
var express = require('express');
var app = express();
//All options required:
var saeoptions = {
	projectPath: __dirname,
	keyPath: "/Path/to/fileWith.key",
	failedAuthFunction : function(req,res){
							res.redirect("/login");
							return; 
						}
};
var sae = require('sec-angular-express')(saeoptions);
//... other requires

//Make sure this is done BEFORE any other middleware!
sae.configure(app);

/*
* Example failed authentication function.
*/

//... rest of your application
```

###2. Start a new session at your login route.
At your login route:
```Javascript
	//...
	if(yourOwnCheckHere){
		var sendData = { send : data };
		var sessionData = { 
			some : session,
			data : here
		}
		//Let sae send a new session.
		res.sae.sendNewSession(req, res, sessionData, sendData); 
	} else {
		// handleErrorYourself
	}
	//...
```
###3. Destroy the session at your logout route.
At your logout route: 
```Javascript
	//...
	var sendData = { msg : "You are logged out!" };
	res.sae.sendDestroySession(req,res,sendData);
	//...
```
