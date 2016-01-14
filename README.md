# rdb2js

2nd generation Rdbhost JavaScript library.   

Use SQL from your browser, for the smoothest easiest possible client-app development process.


The library can be loaded with a script tag, like:

    <script src="https://www.rdbhost.com/vendor/rdbhost/2.0/lib/rdbhost-bundle.js"></script>

but other libraries, including polyfills, will often need to be loaded as well. 

I recommend you use Lab.Js to load all modules, with a code block like:

    <script type="text/javascript" 
            src="https://www.rdbhost.com/vendor/labjs/LAB.js"></script>
    <script>
      var $L = $LAB
          .script('../lib/js/rdbhost-bundle.js')
          .script('../test/private.js').wait()
          .script('../lib/js/rdbhost_livereload.js');

      if (!hasPromises())
        $L = $L.script('../vendor/es6-promises/dist/es6-promise.js');
      if (!hasFetch())
        $L = $L.script('../vendor/fetch/fetch.js').wait();
      $L.script('myTests_auth.js');
    </script>


This loads the rdbhost library and conditionally the necessary polyfills.  `hasPromises` and `hasFetch` 
detect whether `Promise` and `fetch` are available already.  Lab.js loads the libraries asynchronously
and in parallel, for fastest load time.


## Request Objects ##

Sending a query to the server involves a request object.  The request constructors are on the `Rdbhost` 
object, and are called `super`, `reader`, `preauth`, and `auth` after the respective roles.

    var req = Rdbhost.reader();
    
The `super` and `auth` constructors take an optional authcode parameter.


### Request methods #

Most of these methods return the request object `this`, allowing methods to be chained.  

query(sql): provides the sql query to the request.

  returns `this`

listen(channel): wraps the query sql in additional sql that catches any NOTIFYs that get emitted 
   by the query.  It also registers this client to recieve all NOTIFYs payloads on the given _channel_. 
   Once this client is registered, it will receive all NOTIFY payloads on that channel from any connection by
   any client.
   
  returns `this`

params(args, namedParams):  provides args (a list of values) or namedParams (a dictionary of names and
  values) to the request.  Can take either type of parameter, or one of each.  Can be called without 
  parameters to clear any data from request.
   
  returns `this`

form_data(formData): provides a FormData object to the request.  Cannot be used with params in same
  request.  FormData objects contain field data to submit to server.  Any query (q) in the FormData
  will be overwritten by the query provided in query method.
  
  returns `this`

proxy(mode): if a mode other than data query is needed, this method sets the mode.  Possible modes
  are 'email', 'credit', and 'proxy'.

  returns `this`

repeat(ct): if query is to be done repeatedly in the same request, this method records the repeat count.

  returns `this`

clone(): returns a copy of the request, complete with all above options.  Each request can only
  be called once, but can be cloned and each clone called once.

  returns new request

go():  submits the request to the server, and returns a Promise for the results.

  returns Promise


A simple example:

    var prom = Rdbhost.reader()
               .query('SELECT name, address FROM contacts;')
               .go();
    prom.then(function(data) {
            // do something with data
         })
         .catch(function(error) {
            // error will be a JavaScript Error
         });
    
    
    
## Event Emitter ##

The Rdbhost object is an event emmitter, with `on`, `off`, `once` and `emit` methods.

Some named events are:

  'connection-opened', 'connection-closed' indicate that a Websocket has been opened or closed.  
                   the event is provided two parameters, the role ...
  
  'connection-error' indicates an error in the Websocket connection
  
  'database-error' is emitted whenever a query has a database error.  The event is emitted
                   with the complete errorcode, and also with a two-digit errorcode prefix.
                   You can listen for a specific error, such as 'database-error:55b00', or
                   for a class of errors, such as 'database-error:55'.
                   
  'notify-received' is emitted when a NOTIFY payload is received over the Websocket connection.
                   The two parameters are channel and payload.
                   
  'reload-request' indicates the servers SFTP server has saved (or updated) a file in
                   this account.  The rdbhost-livereload library uses this event to
                   conditionally reload files.
                   
  'form-cleared' indicates that a confirmation html form has been cleared from view.
  
  
Example:

    Rdbhost.on('notify-received', function(channel, payload) {
      if (channel === 'chat') {
        add_to_chat_log(payload);
      }
      else if (channel === 'status') {
        if (payload === 'goodbye')
          console.log('user is leaving');
      }
    });
  
