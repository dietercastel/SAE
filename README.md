# Sec-Angular-Express

[Node.js](https://nodejs.org) module to ease the development of a *secure* [Express](http://expressjs.com/)+[Angular.js](https://angularjs.org/) web application. Angular.js provides a couple of nice features that raise the security bar significantly. This module tries to make good use of these features with as little effort as possible for developers.

##Quick start
At the very least you need to do three things:
###1. Configure the module
In your main file:
```JavaScript
var express = require('express');
var app = express();
//All options are required:
var saeoptions = {
	projectPath: __dirname,
	keyPath: "/Path/to/fileWith.key",
	failedAuthFunction : function(req,res){ //Example
							res.redirect("/login");
							return; 
						}
};
var sae = require('sec-angular-express')(saeoptions);
//... other requires

//Make sure this is done BEFORE any other middleware!
sae.configure(app);

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
	//Destroy the session and send some data.
	res.sae.sendDestroySession(req,res,sendData);
	//...
```

##Features

- Centralised authentication on ALL routes except "/" plus those specified in the `excludedAuthRoutes` option.
- Uses client-side sessions to enable proper REST services. 
- Anti-XSRF protection to use in combination with Angular.js.
- Protection against a subtle JSON vulnerability (described [here](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/))
- 

##Q&A

### Why do I need to put my secret in a file?
Because secrets should not reside in (probably) public code. It's therefore advised that you put your secret in a separate file on your server _outside_ your project directory.

### Why shouldn't I use a server side templating engine?
See [this explanation](https://docs.angularjs.org/guide/security#mixing-client-side-and-server-side-templates).
