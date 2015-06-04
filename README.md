# Sec-Angular-Express (SAE)

SAE is a [Node.js](https://nodejs.org) module to ease the development of a *secure* [Express](http://expressjs.com/)+[AngularJS](https://angularjs.org/) web application. AngularJS provides a couple of nice features that raise the security bar significantly. This module tries to make good use of these features with as little effort as possible for developers. The focus of this module is client-side web security it does NOT cover various server-side risks.

Version 1.0 was developed as part of my master thesis at the [Computer Science Department](https://wms.cs.kuleuven.be/) of [KULeuven](http://www.kuleuven.be/kuleuven/).

## Quick start
At the very least you need to do three things:
### 1. Configure and include the SAE module
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

### 2. Start a new session at your login route.
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
*Note*: If you don't use "/" as login route you should add the route you do use to `excludeSessionAuthRoutes`. Otherwise users won't be able to login unless they already have a valid session...

### 3. Destroy the session at your logout route.
At your logout **POST** route: 
```Javascript
	//...
	var sendData = { msg : "You are logged out!" };
	//Destroy the session and send some data.
	res.sae.sendDestroySession(req,res,sendData);
	//Authorisation will fail on subsequent requests.
	//...
```

## Features
- Centralised secure session authentication on ALL routes except "/" and those specified in the `excludeSessionAuthRoutes` option. All defaults are secure and good to go.
- Client-sessions provided by Mozilla's [node-client-sessions](https://github.com/mozilla/node-client-sessions) to enable REST services. Usage similar too regular sessions via `req.csession`.
- [Content Security Policy](https://en.wikipedia.org/wiki/Content_Security_Policy) support to be configured manually in a file or to be used in combination with [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express).
- Incremental CSP updater for non-inline resources based on csp-reports for Firefox and Chrome. Can and should only be used in a testing or development environment. See [updateCSP](#updateCSP).
- [Cross-site Request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery) protection to use in combination with AngularJS (Works without ANY configuration). Protection does not cover 'GET', 'HEAD', 'OPTIONS' HTTP requests for a good reason, see [Q&A](#qa)!
- Extensive logging in JSON with [Bunyan](https://github.com/trentm/node-bunyan) of:
	* All session operations: (authentication) failure, update, create, destroy. Plus size limit warning.
	* Potential XSRF attacks
	* Incoming Content Security Policy reports.
- Protection against a subtle JSON vulnerability (described [here](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/))
- Disabled x-powered-by header.
- Uses [dont-sniff-mimetype](https://github.com/helmetjs/dont-sniff-mimetype) by default.
- Denies frame/iframe inclusion by default (click-jacking protection) with [frameguard](https://github.com/helmetjs/frameguard).

*NOTE : All default settings are meant to be as secure as possible and are consciously set to follow OWASP guidelines. Do not change optional settings just because you can because it will very likely reduce your security!*

## Library Options

### projectPath (String, REQUIRED)
The path to your project folder. `__dirname` in your main file can often be used for this setting.

### keyPath (String, REQUIRED)
The absolute path to a file containing the server-side key for encrypting the client-side sessions.
Example: `/path/to/keyfile.key` pointing to a file containing only `mynb1supersecretkey4me`.
Do not put this file under version control! This feature is especially intended to avoid placing private data into open by accident for example on a public github repository. Be wary of your keys/secrets/private info!

####Key format restriction
The key in the file is check against 2 very simple rules to make sure it's sufficiently secure (for now). The key must be at least 16 characters long and needs to include at least two words (letter sequences separated by a non-letter sequence).  Optimally, you use a long true random generated string that will most likely fit these requirements.

### failedAuthFunction (function, REQUIRED)
A function that gets executed when a request is not properly authenticated. 
Example
```JavaScript
function(req,res){
	//Calling next() here is NOT a good idea!
	res.redirect("/login");
	return; 
}
```

### reportRoute (String, Optional)
Default value: `'/reporting'`
Route that is used to acquire various reports most notably Content Security Policy Reports. This route is excluded from any form of build in authentication so there is no need to add this route to the `excludeSessionAuthRoutes` option.

### cspReportOnly (Boolean, Optional)
Default value: `false`
Use CSP report-only mode if this setting is `true`. This is beneficial while testing and works very well with the [updateCsp](#updateCSP) mechanism. If this is true when the environment is not 'testing' or 'development' it will generate a warning. So don't forget to set it back to `false` when launching your application publicly. 

### proxyPrefix (String, Optional)
Default value: `''`
Prefix used in combination with the `reportRoute` URL. If you're not behind a proxy you will never need this.

### cspFile (String, Optional)
Default value: `'/csp.json'`
File path relative to your project to a file describing your content security policy. Intended to work in combination with [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express) and/or the [updateCsp](#updateCsp) feature.

This file can also be manually created using the following template in a file. Don't forget to remove the directives you don't need because a more specific directive will override a more general one.
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
### newCspFile (String, Optional)
Default value: `'/newcsp.json'`
File path relative to your project to a file that will be created when using the [updateCSP](#updateCSP) feature. Before using this file as your CSP verify that it is as restrictive as possible. Do *NOT* use a newCspFile file that has been generated in a *PRODUCTION* environment as it may lead to whitelisting an actual attack!

### useLocalhostAsSelf (Boolean, Optional)
Default value: `true`
Determines whether the [updateCSP](#updateCSP) mechanism will interpret `localhost` and `127.0.0.1` as `'self'`for creating the newCspFile. If you're running only your webapplication on your localhost while developing this setting is probably fine. If you use an actual named domain or various interacting services on localhost check out the `useNameAsSelf` setting.

### useNameAsSelf (String, Optional)
Default value: `undefined`
If the string in this setting is found as an origin to add to the newCspFile `'self'` will be used instead. This is useful if you can't use `useLocalhostAsSelf`(because you are using vhosts for example) and still want the generic `'self'` in your CSP.

### cspReportsLog (String, Optional)
Default value: `'/cspReports.log'`
File path relative to your project to the file where Content Security Policy reports should be stored.

### csessionLog (String, Optional)
Default value: `'/csession.log'`
File path relative to your project to the file where all session events should be stored.

###	logSessionData (Function, Optional)
Default value:
```JavaScript
function(csession){
	return {};
}
```
Function that returns an object containing session data that will be logged at every session event. Beware that the session data could contain sensitive information. This is why I explicitly give you the option to select what session information you NEED to log. Other request parameters like URL, headers, etc. are already being logged. The csession cookie is not logged because it is equivalent to logging the session ID which is also a bad idea (see [this OWASP page](https://www.owasp.org/index.php/Session_Management_Cheat_Sheet#Logging_Sessions_Life_Cycle:_Monitoring_Creation.2C_Usage.2C_and_Destruction_of_Session_IDs)). 

### xsrfFailureLog (String, Optional)
Default value: `'/xsrfFailure.log'`
File path relative to your project to the file where possible XSRF attacks should be logged.

### excludeSessionAuthRoot (Boolean, Optional)
Default value: `true`
Determines whether to exclude the root path "/" from the session authentication mechanism.
Only the "/" path is excluded when true for obvious reasons. NOT "/somethinghere" nor "/some/thing/here".
We assume that "/" is often used as public entry point for the web application that's why the default value is `true`. Setting this to false would result in making your application inaccessible to anyone without a valid session unless you excluded other routes with the `excludeSessionAuthRoutes` option described next.

### excludeSessionAuthRoutes ([String], Optional)
Default value: `[]`
Other routes to exclude from the session authentication mechanism. Login route, register route and any resources that should be accessible without a valid session should be excluded. If you exclude for example `"/login"` all paths starting with `"/login/"` will ALSO be excluded from authentication. E.g. `"/login/admin"` and  `"/login/some/thing/here"` will be accessible without a valid session. 

### sessionIdleTimeout (Integer, Optional)
Default value: `1200`
Time in seconds a session should last. It's advised to set this session as short as possible. The default value makes the session last for 20 minutes as suggested by [OWASP](https://www.owasp.org/index.php/Session_Management#How_to_protect_yourself_4). The session will also end on closing of the browser.

### sessionRefreshTime (Integer, Optional)
Default value: `300`
Time in seconds the session lifetime will be extended with if there is HTTP activity. Each request can extend the session lifetime if it's nearing it's end if the session hasn't passed it's absolute expiry time.

### sessionAbsoluteExpiry (Integer, Optional)
Default value: `21600`
Time in seconds after which a session will certainly expire. A session can no longer be refreshed if it has passed this time. By default this is 6 hours. This prevents a stolen or 'lost' session from being misused indefinitely. 

### secureCookie (Boolean, Optional)
Default value: `true`
Forces to only allow the session cookies to be used over a https connection. You really should be using HTTPS even just with some free certificate like [StartSSL Free](https://www.startssl.com/?app=1) or [Let's Encrypt](https://letsencrypt.org/) when it goes live. If you don't use HTTPS remember that everything will be send in plaintext: passwords, sensitive information, ...!!

### cookiePath (Boolean, Optional)
Default value: `'/'`
The path on which the client-session cookie will be used. Making this path as restrictive as possible is good practice. This means that if you only serve authenticated users from a '/secretive' path you should set this setting to only be included when the URL contains that path.

### disableCsessionSizeWarning (Boolean, Optional) 
Default value: `false`
If set to true this setting disables the logging of a size warning if the csession cookie is becoming exessivly large (> 2kb).

### disableJSONPrefixing (Boolean, Optional)
Default value: `false`
Determines whether to prefix JSON body data to prevent [this](http://haacked.com/archive/2008/11/20/anatomy-of-a-subtle-json-vulnerability.aspx/) attack. The prefix is automatically stripped by AngularJS at the client side.
### disableFrameguard (Boolean, Optional)
Default value: `false`
Removes frameguard protection. Only set this to true if you actually need frame/iframe inclusion.
If you do, I highly recommend whitelisting the allowed domains in the Content Security Policy.

## SAE object Methods
### configure(app)
Configures SAE. Strongly advised to use this method before other uses of `app.use()`, routers or any other middleware.
#### Arguments
- `app` : the express application to configure.

### handleErrors(app)
Handles the error's thrown by SAE. A good idea to place this as first error that will be handled.
#### Arguments:
- `app` : the express application to configure.

## SAE object Properties
### defaults
Property that contains the default configuration object.

### options
Property that contains the current configuration object.

### sessionAuthRoutesRegex
Property that contains a regex that can be used as route in express. It includes all the routes that are not explicitly excluded by either `excludeSessionAuthRoot` or `excludeSessionAuthRoutes`.
E.g.
```JavaScript
var express = require('express');
var app = express();
//...saeoptions...
var sae = require('sec-angular-express')(saeoptions);
app(sae.sessionAuthRoutesRegex, function(res, req, next){
	console.log("Only accesible with a valid (client)session!");
});
```

## Request and Response object additions

### req.sae.opt = res.sae.opt
This is the options object used by SAE internally. It's however not recommended to change options here. To set the options use the object passed to the constructor of the SAE middleware.

### req.csession
Object property of a request used to retrieve and store client-session data. The contents of this object is stored in an encrypted cookie with [client-sessions](https://www.npmjs.com/package/client-sessions). The decryption and encryption is done automatically on each authenticated request and response respectively. Just setting a value of csession and sending the response is sufficient. Session creation (sendNewSession) and destruction (sendDestroySession) should be done with the methods below.

####Size limitation
Beware that all session data is transmitted on every request. This means that there should not be large amounts of data stored in the session. Use your database storage and place only a reference to it in the csession instead. Most browsers also don't allow cookies to be larger than 4kb. A warning will logged if the csession cookie is getting excessively large.

Usage:
```JavaScript
//... In some authenticated route
req.csession["mycounter"] = 1;
//... (sets the encrypted cookie and) sends the response. 
res.send();
```
*IMPORTANT NOTE*: Don't use `req.csession["expiresAbsolutelyAt"]`, nor `req.cession["csessionLogID"]`. Both are used internally in SAE. Changing these will lead to unexpected behaviour!

### res.sae.sendNewSession(req, res, sessionData, sendData)
Creates a new client-session with the given sessionData and sends the given sendData. This function should be used when a user successfully authenticates for the first time. The encrypted cookie used to do this serves as authentication cookie for subsequent requests. This call ends the processing of a request like res.send(sendData) would do. Because this function changes state it should only be used in a POST method route. An error will be thrown otherwise.
#### Arguments:
- `req` : The express request object.
- `res` : The express response object.
- `sessionData` : Object containing the data that should be stored in the client-side session.
- `sendData` : The data that will be send in the response. Identical to the argument in res.send(sendData).

### res.sae.sendDestroySession(req,res,sendData);
Clears the client-side session and sends the given sendData. The encrypted cookie will not contain any more data and will not be able to authenticate a request. This call ends the processing of a request like res.send(sendData) would do. Because this function changes state it should only be used in a POST method route. An error will be thrown otherwise.

#### Arguments:
- `req` : The express request object.
- `res` : The express response object.
- `sendData` : The data that will be send in the response. Identical to the argument in res.send(sendData).

### req.sae.sessionAuthRoutesRegex = res.sae.sessionAuthRoutesRegex
Property that contains the same regex as [sessionAuthRoutesRegex](#sessionAuthRoutesRegex).

## Grunt-csp-express
To get started with using CSP I recommend [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express) which I developed to work well in combination with this library.
To get up and running easily follow the Quick Start guide below.

### Quick Start

1. Run `npm install -g grunt-cli` (Installs grunt cli tools globally).
2. In your project directory run `npm install grunt --save-dev` (Installs the grunt task runner locally and saves it as a development dependency).
3. In your project directory run `npm install grunt-csp-express --save-dev` (Installs the grunt-csp-express tool locally and again saves it as a development dependency).
4. In your project directory create a file called `Gruntfile.js` and paste the basic Gruntfile.js below in it.
5. In your project directory run `grunt makecsp`. This will scan your directory for rules to use as CSP and place a file called `csp.json` in your project directory that can instantly be used as CSP with Sec-Angular-Express.

Basic Gruntfile.js:
```JavaScript
module.exports = function(grunt) {
  // Project configuration. 
  grunt.initConfig({
    makecsp: {
      default_options: { 
		//target with default_options uses '.' as directory 
      }
    }
  });
 
  // This plugin provides the necessary task. 
  grunt.loadNpmTasks('grunt-csp-express');
 
  // By default, just run makecsp  
  grunt.registerTask('default', ['makecsp']);
};
```

For any issues check the [grunt-csp-express page](https://www.npmjs.com/package/grunt-csp-express) or the [Getting Started Guide](http://gruntjs.com/getting-started) of Grunt.


## UpdateCSP
The SAE library includes a feature to help you build a CSP incrementally.
You can start with no CSP file, one generated by [grunt-csp-express](https://www.npmjs.com/package/grunt-csp-express) or your own manual configuration. This feature is tested with both Firefox and Chrome. Because the csp-reports generated by Chrome contain slightly more information I got the most restrictive (best) results while using Chrome. Note that this mechanism can only reduce restrictiveness if you remove a certain resource either restart the procedure without a CSP (defaults to the most restrictive CSP) or remove the resource manually from your current CSP.
To use this feature the following steps should be undertaken, pay close attention to the warnings!

1. Ensure that you are in a development or testing environment. It's not advised to use this while your website is live because this can lead to accidentally whitelisting an actual attack. 
2. In a shell on your development/testing machine run 
`export NODE_ENV=development` or `export NODE_ENV=testing`. 
This is the standard way of letting your Node.js application know in what environment it is running.
3. Set the `cspReportOnly` option to `true` (for faster results).
4. Start your application.
5. Browse through your application, test some stuff, visit all pages that load new resources...
6. Check the updated policy in `/newcsp.json` (or another name depending on your SAE options).
7. If it seems correct and restrictive enough use it as your new CSP (by replacing your actual policy with this file.).
8. *IMPORTANT*: Set the `cspReportOnly` to `false` and test with your newly enabled policy.

Furthermore you can configure this feature with two settings:
`useLocalhostAsSelf` (default `true`) will replace `localhost` and `127.0.0.1` with `'self'` in the new CSP.
If `useNameAsSelf` is set it will replace origins that contain `useNameAsSelf` with `'self'` in the new CSP.

## Viewing logs with Bunyan

All the logs are created with [Bunyan](https://github.com/trentm/node-bunyan) to be able to log in a structured way. Viewing the logs in a nice format is very easy by using the Bunyan cli tool. Install it first via npm:
`npm install -g bunyan`
Next you can easily view any logs by using the tool in the terminal. e.g. `bunyan csession.log` or `bunyan cspReports.log`. For more infromation run `bunyan -h` or check out [this section of the Bunyan README](https://github.com/trentm/node-bunyan#cli-usage).

## Q&A

### Will the library work if I don't use AngularJS?
Some parts will (csession auth, CSP) some parts won't (XSRF protection). Therefore it's highly recommended to use AngularJS. AngularJS is the first line prevention against [XSS](https://en.wikipedia.org/wiki/Cross-site_scripting) and provides some security features for which this library is preconfigured.

### Why do I need to put my secret in a file?
Because secrets should not reside in (probably) public code. It's therefore advised that you put your secret in a separate file on your server _outside_ your project directory. History has shown that they end up publicly [all to often](https://rosspenman.com/api-key-exposure/).

### Why shouldn't I use a server side templating engine?
See [this explanation](https://docs.angularjs.org/guide/security#mixing-client-side-and-server-side-templates).

### Why aren't 'GET', 'HEAD', 'OPTIONS' requests checked against XSRF?
Because neither of these should be able to execute a sensitive operation, they are considered [safe methods](https://tools.ietf.org/html/rfc7231#section-4.2.1). If they do in your application you should redesign it to fit the proper HTTP specifications.

### Why shouldn't I use the updateCSP mechanism in a production environment?
The updated CSP file could allow malicious resources by accident. It makes use of incoming csp-reports. These are generated by the browser to indicate when your Content-Security-Policy gets violated. While creating your application these reports will most likely be harmless (e.g. forgot to add a new resource to your existing CSP). In a live production environment these could totally undermine CSP protection. That's also the reason I chose not to automatically update the used CSP. You should ALWAYS verify the newly generated CSP before using it to see it doesn't contain anything you don't want.

### Why can't I use inline scripts and CSS when using CSP?
Because there is no way trivial way the browser can tell inline scripts apart from malicious injections. CSP does in fact support hash/nonce values to allow them and still be able to verify these resources. But for new applications this is not advised that's why I choose not to support it in SAE. Inline scripting/styling is also considered bad practice and should therefore be avoided!
