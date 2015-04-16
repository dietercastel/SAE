#Ideas for Sec-Angular-Express 
##Misc
make a grunt-sae tool that includes:

grunt-replace 
Client-session and other keys with a sync read to a folder outside of the project?
This folder has only read permissions for the current $USER?

grunt makecsp ofcourse

extend express project generator with security in mind?

EPR:
http://randomdross.blogspot.be/2014/08/entry-point-regulation-for-web-apps.html

##Helmet sec lib
In order of usefulness

###Frameguard
Allow/dissallow iframe inclusion on certain domains. 
https://github.com/helmetjs/frameguard

###Hide X-Powered-By
Seems useful but no big deal (security by obscurity)
https://github.com/helmetjs/hide-powered-by

###"Don't infer the MIME type" middleware
Makes sense.
https://github.com/helmetjs/dont-sniff-mimetype

###HTTP Public Key Pinning (HPKP) middleware
Useful, also client-side security.
But hard to test maybe? Https cert needed etc.
https://github.com/helmetjs/hpkp

###HTTP Strict Transport Security middlware
Useful include with use https flag?
https://github.com/helmetjs/hsts

###Middleware to turn off caching
Massive performance hit for tiny security improvement?
https://github.com/helmetjs/nocache


###Less interesting:
https://github.com/helmetjs/ienoopen

Enabled by default and only in IE9+ and Chrome.
https://github.com/helmetjs/x-xss-protection

