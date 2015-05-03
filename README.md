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

//... app.use/routes

sae.handleErrors(app);

// .. other error handling
```

###2. Start a new session at your login route.
At your login **POST** route:
```Javascript
	//...
	if(yourOwnCheckHere){
		var sendData = { send : data };
		var csessionData = { 
			"some" : "session",
			"data" : "here"
		}
		//Let sae send a new session.
		res.sae.sendNewSession(req, res, csessionData, sendData); 
		//In subsequent requests the data can be accessed via
		//via the req.csession object e.g.: req.csession["some"]
	} else {
		// handleErrorYourself
	}
	//...
```
*Note*: If you don't use "/" as login route you should add that route to `excludedAuthRoutes`. Otherwise users won't be able to login unless they already have a session.

###3. Destroy the session at your logout route.
At your logout **POST** route: 
```Javascript
	//...
	var sendData = { msg : "You are logged out!" };
	//Destroy the session and send some data.
	res.sae.sendDestroySession(req,res,sendData);
	//Authorisation will fail on subsequent requests.
	//...
```

##Features
- Centralised session authentication on ALL routes except "/" plus those specified in the `excludedAuthRoutes` option.
- Using Mozilla's [node-client-sessions](https://github.com/mozilla/node-client-sessions) to enable REST services. 
- [Cross-site Request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery) protection to use in combination with Angular.js (works without ANY configuration). 
- Protection against a subtle JSON vulnerability (described [here](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/))
- [Content Security Policy](https://en.wikipedia.org/wiki/Content_Security_Policy) support to be configured manually in a file or to be used in combination with [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express).
- Disabeled x-powered-by header.
- Uses [dont-sniff-mimetype](https://github.com/helmetjs/dont-sniff-mimetype) by default.
- Denies frame/iframe inclusion by default (click-jacking proctection) with [frameguard](https://github.com/helmetjs/frameguard)

##Options

###projectPath (String, REQUIRED)
The path to your project floder. `__dirname` in your main file can often be used for this setting.

###keyPath (String, REQUIRED)
The absolute path to a file containing the server-side key for encrypting the client-side sessions.
Example: `/path/to/keyfile.key` pointing to a file containing only `mysupersecretkeyiwillbeusing`.

###failedAuthFunction (function, REQUIRED)
A function that gets executed when a request is not proberly authenticated. 
Example
```JavaScript
function(req,res){
	//Calling next() here is NOT a good idea.
	res.redirect("/login");
	return; 
}
```

###reportRoute (String, Optional)
Default value: `'/reporting'`
Route that is used to acquire various reports most notably Content Security Policy Reports.
This route is excluded from any form of build in authentication so there is no need to add this route to the `excludedAuthRoutes` option.

###proxyPrefix (String, Optional)
Default value: `''`
Prefix used in combination with the `reportRoute` url. 
If you're not behind a proxy you will never need this.

###cspFile (String, Optional)
Default value: `'/csp.json'`
File path relative to your project to a file describing your content security policy.
Intended to work in combination with [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express).

This file can also be manually created using the following template in a file.
Don't forget to remove the directives you don't need because a more specific directive will override a more general one.
```JavaScript
{
    "default-src": [],
    "script-src": [],
    "object-src": [],
    "style-src": [],
    "img-src": [],
    "media-src": [],
    "frame-src": [],
    "font-src": [],
    "connect-src": [],
	"sandbox" : []
}
```

###cspReportsLog (String, Optional)
Default value: `'/cspReports.log'`
File path relative to your project to the file where Content Security Policy reports should be stored.

###authReportsLog (String, Optional)
Default value: `'/authReports.log'`
File path relative to your project to the file where failed authentication reports should be stored.

###JSONPrefixing (Boolean, Optional)
Default value: `true`
Determines whether to prefix JSON body data to prevent [this](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/) attack. The prefix is automatically stripped by angular.js at the client side.

###excludeAuthRoot (Boolean, Optional)
Default value: `true`
Determines whether to exclude the root path "/" from the authentication mechanism.
Only the "/" path is excluded when true. Not "/somethinghere" nor "/some/thing/here".

###excludedAuthRoutes ([String], Optional)
Default value: `[]`
Other routes to exclude from the authentication mechanism. Login route, register route and any resources that should be accessible without authentication should be excluded.
If you exclude for example "/login" all paths starting with "/login/" will ALSO be excluded from authentication. So "/login/admin","/login/some/thing/here" will also be excluded from the authentication middleware. 

###sessionLifeTime (Integer, Optional)
Default value: `1200``
Time in seconds a session and XSRF token should last. It's advised to set this session as short as possible. The default value makes the session last for 20 minutes as suggested by [OWASP](https://www.owasp.org/index.php/Session_Management#How_to_protect_yourself_4). The session will also end on closing of the browser.

###secureCookie (Boolean, Optional)
Default value: `false`
Forces to only allow the session cookies to be used over a https connection.
It's highly recommended to use https and then enable this setting.

###cookiePath (Boolean, Optional)
Default value: `'/'`
The path on which the client-session cookie will be used.
Making this path as restrictive as possible is good practice.
This means that if you only serve authenticated users from a '/secretive' path you should set this setting to only be included when the url contains that path.

###disableFrameguard (Boolean, Optional)
Default value: `false`
Removes frameguard protection. Only set this to true if you actually need frame/iframe inclusion.
If you do, consider whitelisting the allowed domains in the Content Security Policy.

###clientSessionOpt (Object, Optional)
Default value: 
```JavaScript
{ 
	cookieName : 'csession',
	secret : 'key stored in opt["keyPath"]'
	duration: opt["sessionLifeTime"]*1000, 
	activeDuration: opt["sessionLifeTime"]*500, 
	cookie: 
		{
			path:opt["cookiePath"],  
			secure: opt["secureCookie"],
			httpOnly: true,
			ephemeral: true 
		}
}
```
Object to be used as options for [node-client-sessions](https://github.com/mozilla/node-client-sessions).
As `secret` option by default the key stored in `keyPath` is used. It's NOT recommended to set this object yourself unless you really know what you are doing.

##Methods
###configure(app)
Configures SAE. Strongly advised to use this method before other uses of app.use(), routers or any other middleware.
####Arguments
app : the express applictation to configure.

###handleErrors(app)
Handles the error's thrown by SAE. A good idea to place this as first error that will be handled.
####Arguments:
- app : the express applictation to configure.

##Request and Response ojbect additions

###req.sae.opt = res.sae.opt
This is the options object used by SAE internally. It's however not recommended to change options here. To set the options use the object passed to the constructor of the SAE middleware.

###req.csession
Object property of a request used to retrieve and store client-session data. The contents of this object is stored in an encrypted cookie with [client-sessions](https://www.npmjs.com/package/client-sessions). The decryption and encryption is done automatically on each authenticated request and response respectively. Just setting a value of csession and sending the response is sufficient. Session creation (sendNewSession) and destruction (sendDestroySession) should be done with the methods below. Beware that all session data is transmitted on every request. This means that there should not be large amounts of data stored in the session. Use your database storage and place only a reference to it in the csession instead. 

Usage:
```JavaScript
//... In some authenticated route
req.csession["mycounter"] = 1;
//... (sets the encrypted cookie and) sends the response. 
res.send();
```

###res.sae.sendNewSession(req, res, sessionData, sendData)
Creates a new client-session with the given sessionData and sends the given sendData. This function should be used when a user succesfully authenticates for the first time. The encrypted cookie used to do this serves as authentication cookie for subsequent requests. This call ends the processing of a request like res.send(sendData) would do.
####Arguments:
- req : The express request object.
- res : The express response object.
- sessionData : Object containing the data that should be stored in the client-side session.
- sendData : The data that will be send in the response. Identical to the argument in res.send(sendData).

###res.sae.sendDestroySession(req,res,sendData);
Clears the client-side session and sends the given sendData. The encrypted cookie will not contain any more data and will not be able to authenticate a request. This call ends the processing of a request like res.send(sendData) would do.

####Arguments:
- req : The express request object.
- res : The express response object.
- sendData : The data that will be send in the response. Identical to the argument in res.send(sendData).

##Q&A

###Will the library work if I don't use Angular.js?
Some parts will some parts won't. Therefore it's highly recommended to use Angular.js. Angular.js is the first line prevention against XSS and provides some other features for which this library is preconfigured.

### Why do I need to put my secret in a file?
Because secrets should not reside in (probably) public code. It's therefore advised that you put your secret in a separate file on your server _outside_ your project directory.

### Why shouldn't I use a server side templating engine?
See [this explanation](https://docs.angularjs.org/guide/security#mixing-client-side-and-server-side-templates).

### Why aren't 'GET', 'HEAD', 'OPTIONS' request checked against XSRF?
Because neither of these should be able to execute a sensitive operation, they are considered [safe methods](http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html#sec9.1.1). If they do in your application you should redesign it to fit the proper HTTP specifications.
