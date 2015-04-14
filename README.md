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
- [Cross-site Request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery) protection to use in combination with Angular.js (works without ANY configuration).
- Protection against a subtle JSON vulnerability (described [here](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/))
- [Content Security Policy](https://en.wikipedia.org/wiki/Content_Security_Policy) support to be configured manually in a file or to be used in combination with [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express).

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

This file can also be manually created using the following template in a file:
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
Other routes to exclude from the authentication mechanism. Login, logout, register routes and any resources that should accessible without authentication should be excluded.
If you exclude for example "/login" all paths starting with "/login/" will ALSO be excluded from authentication. So "/login/admin","/login/some/thing/here" will also be excluded from the authentication middleware. 

###sessionLifeTime (Integer, Optional)
Default value: `3600`
Time in seconds a session and XSRF token should last. It's advised to set this session as short as possible.

###httpsOnlyCookie (Boolean, Optional)
Default value: `false`
Forces to only allow the session cookies to be used over a https connection.
It's highly recommended to use https and then enable this setting.

##Q&A

### Why do I need to put my secret in a file?
Because secrets should not reside in (probably) public code. It's therefore advised that you put your secret in a separate file on your server _outside_ your project directory.

### Why shouldn't I use a server side templating engine?
See [this explanation](https://docs.angularjs.org/guide/security#mixing-client-side-and-server-side-templates).
