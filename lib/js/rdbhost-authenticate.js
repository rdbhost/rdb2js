
(function(window, undefined) {

    /* redirect browser to new url

     */
    function redirect(location) {
        window.location.assign(location);
    }

    /* start federated identity authentication process.

      @param provider: which federated identity provider to use (Facebook, Twitter, etc)

      @returns: never returns, as page reloads before then
     */
    function initiate_fedauth_login(provider, path) {

        var loc = document.createElement('a'),
            acct = Rdbhost.account_number(),
            host = Rdbhost.host(),
            searchParts = [];
        loc.href = "/";

        // query server to get provider information for _provider_, including ver
        var provProm = Rdbhost.preauth().query('SELECT version, client_key FROM auth.fedoauth_providers ' +
            'WHERE provider = %s').params([provider]).get_data();

        provProm.then(function(d) {

                var key = d.result_sets[0].rows[0].client_key,
                    vers = d.result_sets[0].rows[0].version;

                if (vers === "2")
                    loc.pathname = '/auth/oauth2/one';
                else if (vers === "1")
                    loc.pathname = '/auth/oauth1/one';
                else
                    loc.pathname = ''; // handle openid here

                loc.hostname = host;
                searchParts.push('provider='+encodeURIComponent(provider));
                searchParts.push('path='+encodeURIComponent(path));
                searchParts.push('acct='+encodeURIComponent(acct));
                searchParts.push('ver=2');
                loc.search = '?'+searchParts.join('&');

                redirect(loc);
            })
            .catch(function(e) {
                throw e;
            });
    }

    /* finalize federated identity authentication process.
        checks whether user has login cookie from fed ident login, provides to promise resolve if so

      @returns: promise, resolving with authenticated identifier and key, or rejecting
     */
    function confirm_fedauth_login() {

        var acct = Rdbhost.account_number(),
            host = Rdbhost.host();

        var confProm = fetch('https://'+host+'/static/auth?uid='+acct,
                            {mode: 'cors', method: 'get', credentials: 'include'});

        return confProm.then(function(d) {
                return d.json().then(function(body) {
                    return { identifier: body.ident,
                             issuer: body.issuer,
                             key: body.key,
                             status: body.status };
                })
            })
            .catch(function(e) {
                return { status: 'confirm-failed' };
            });
    }


    /* check user credentials against login table

      @param userid: name this user logs in as, sometimes email address
      @param password: password from user

      @returns: promise that resolves or rejects
     */
    function password_login(userid, password) {

    }


    /* log user out, from whichever method they used to login

        there is no logout, as login credentials, once login is completed, are handled by
        client code, not Rdbhost code.
     */


    /* extend Rdbhost request object to add Charge specific functions

     */
    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        fedauth_login:          initiate_fedauth_login,
        confirm_fedauth_login:  confirm_fedauth_login,

        password_login:         password_login,

        extended:               'authenticate'
    });


}(window));


(function(window) {


    /* supervisory functions that handle setup
     *
     */

    var createLoginTable = 'CREATE TABLE auth.password_accounts ( \
                              ident VARCHAR(100), \
                              email VARCHAR(150) NULL, \
                              password VARCHAR(150) \
                            );';

    function add_login_table() {

        return Rdbhost.super()
                .query(createLoginTable)
                .go();
    }


    var addLoginEntry = "INSERT INTO auth.password_accounts \
                                     (ident,     email,     password) \
                              VALUES (%(ident)s, %(email)s, %(password)s;";

    function insert_loginentry_sql(parms) {

        return Rdbhost.super()
            .query(addApiKey)
            .params({'ident': parms[0], 'email': parms[1], 'password': parms[2]})
            .go();
    }


    /* extend Rdbhost object to add Authentication specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.admin = _.extend(window.Rdbhost.admin || {}, {

        'add_table': function(tablename) {

           },

        'insert_apikey_sql': function(parms) {

           }

    })

}(window));