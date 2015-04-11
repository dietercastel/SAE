# Sec-Angular-Express (SAE)
The plan is to greatly minimize the effort required to setup a secure express-angular.js application.
Combining several common countermeasures and best practices that are currently scattered on the internet.
The ideal would be that even an inexperienced developer can start using Node.Js and angular and just require this module to provide a decent level of security.

Of course some configuration will be required but this will at least be centralised in one module instead of several.

##Protections it provides
Proper client-side (contextualized) output encoding is provided by the use of Angular.js.

##TODO:
Determine minimum nodejs version requirement!
1.3 for Angular.js?

introduce loginRoute and logoutRoute?
(no FailedAuth needed by default?)

##Planned

###CSP (HIGH) 
CSP support using this package? 
(Or implement it yourself?)
https://www.npmjs.com/package/content-security-policy

Insert <ang-csp> tag into the code (by default if CSP is enabled).

Make gulp/grunt preprocess all files and find urls to use in CSP.
Split up http and https urls.
To make it clear they should use https.

###CSRF protection (HIGH)
Use system that deploys the default angular.js CSRF protection.

###


###JWT (LOW)
Might be useful to include a JWT option that can be used as authorization.

####EPR (OPTIONAl)
Fascinating project.
https://github.com/google/epr

Security in depth? 
Automatic creation of epr-manifest.json?
Use same preprocessing as with CSP.

###Warning system (HIGH)
####Known bad practices in Angular.js
Preprocessor could also scan for the dirty gif inclusion (Heiderich) in Angular.Js part.
####Non-https urls in code

###Reporting system (HIGH)
####Request logging by default.
####CSP reporting (HIGH)
####CSRF reporting (HIGH)
####EPR reporting (OPTIONAl)


###Settings
Provide sane defaults but also options to turn them off.
Store server-side passwords (e.g. client-session) in seperate file.
Maybe also grunt this into the result?
	
