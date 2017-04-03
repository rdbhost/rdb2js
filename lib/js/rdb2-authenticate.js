
(function(window, undefined) {

    /* redirect browser to new url

     */
    function redirect(location) {
        if (Rdbhost.in_test_mode) {
            throw new Error('test-mode '+location);
        }
        window.location.assign(location);
    }

    /* start federated identity authentication process.

      @param provider: which federated identity provider to use (Facebook, Twitter, etc)
      @param return_path: return_path that rdbhost redirects to at end of sequence.

      @returns: never returns, as page reloads before then
     */
    function initiate_fedauth_login(provider, return_path) {

        if (typeof return_path === 'undefined')
            return_path = window.location.origin;
        if (typeof return_path === 'undefined')
            throw new Error('----- bad path provided to fedauth_login');
        var loc = document.createElement('a'),
            acct = Rdbhost.account_number(),
            host = Rdbhost.host(),
            searchParts = [];
        loc.href = "/";

        // query server to get provider information for _provider_, including ver
        var provProm = Rdbhost.preauth().query('SELECT version, client_key>\'\' AS haskey FROM auth.fedoauth_providers ' +
                                               'WHERE provider = %s').params([provider]).get_data();

        return provProm.then(function(d) {

                var rows = d.result_sets[0].records.rows;
                if (rows === undefined || rows.length === 0)
                    throw new Error('rdbfa fedauth provider not registered');

                var haskey = d.result_sets[0].records.rows[0].haskey,
                    vers = d.result_sets[0].records.rows[0].version;

                if (!haskey) {
                    return Rdbhost.super().query('DELETE FROM auth.fedoauth_providers WHERE provider = %s ')
                        .params([provider]).get_data().then(function(d) {
                            throw new Error('rdbfa fedauth provider not registered');
                        })
                }
            
                if (vers === "2")
                    loc.pathname = '/auth/oauth2/one';
                else if (vers === "1")
                    loc.pathname = '/auth/oauth1/one';
                else
                    loc.pathname = ''; // handle openid here

                loc.hostname = host;
                searchParts.push('provider='+encodeURIComponent(provider));
                searchParts.push('path='+encodeURIComponent(return_path));
                searchParts.push('acct='+encodeURIComponent(acct));
                searchParts.push('ver=2');
                loc.search = '?'+searchParts.join('&');

                redirect(loc);
            })
            .catch(function(e) {
                
                if (e.message.substr(0, 5) === 'rdbfa') {

                    var p = Rdbhost.admin.fedauth_dialog(provider);
                    return p.then(function(d) {

                        var afe = Rdbhost.admin.add_fedauth_entry(d);
                        return afe.then(function(d) {
                                return initiate_fedauth_login(provider, return_path);
                            })
                      })
                }
                else
                    throw e;
            })
    }

    /* finalize federated identity authentication process.
        checks whether user has login cookie from fed ident login, provides to promise resolve if so

      @returns: promise, resolving with object containing authentication data for user, or rejecting
          authentication object has keys 'identifier', 'issuer', 'key' and 'status'.
            status is one of ['loggedin', 'cancelled', 'failure'].
            issuer is name of provider 'Facebook', 'Twitter' etc
            identifier is verified identity from provider (typically a long numerical string)
            key is a secret code associated with this identifier within your 'auth.fedauth_accounts' table
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
                             status: body.status,
                             idx: body.idx };
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

        function _go() {

            var preauth = Rdbhost.preauth();

            var p = preauth.query("SELECT fa.ident, fa.key FROM \n" +
                "  auth.fedauth_accounts fa JOIN auth.account_passwords a ON a.idx=fa.idx \n" +
                "  WHERE md5(%(password)s) = a.password \n" +
                "     AND fa.identifier = '%(userid)s' AND fa.issuer = 'LocalPassword'; ")
                .params({userid: userid, password: password})
                .get_data();

            return p.then(function(d) {

                    debugger;
                })
                .catch(function(e) {

                    var _splitPt = e.message.indexOf(' '),
                        splitPt = _splitPt >= 0 ? _splitPt : e.message.length,
                        errCode = e.message.substr(0, splitPt), errMsg = e.message.substr(splitPt+1);

                    if (errCode === '42P01') {

                        var m = /relation "([^"]+)" does not exist/.exec(errMsg);
                        if (m) {
                            var missing_tablename = m[1];
                            var p1 = Rdbhost.Authenticate.admin.add_table(missing_tablename);
                            return p1.then(_go);
                        }
                    }
                    debugger;
                });
        }

        return _go();
    }


    /* log user out, from whichever method they used to login

        there is no logout, as login credentials, once login is completed, are handled by
        client code, not Rdbhost-provided code.
     */


    /* extend Rdbhost object to add Authenticate specific functions

     */
    window.Rdbhost.Authenticate = Rdbhost.extendObject(window.Rdbhost, {

        fedauth_login: initiate_fedauth_login,

        confirm_fedauth_login: confirm_fedauth_login,

        password_login: password_login
    })

}(window));


(function(window) {


    function fedauth_dialog(provider) {

        function on_submit(f, resolve) {
            var r = {};

            r.provider = f.querySelector("input[name='provider']").value;
            r.version = f.querySelector("input[name='version']").value;
            r.mode = f.querySelector("input[name='mode']").value;

            r.client_key = f.querySelector("input[name='client_key']").value;
            r.client_secret = f.querySelector("input[name='client_secret']").value;

            r.redirect = f.querySelector("input[name='redirect']").value;
            r.req_token_url = f.querySelector("input[name='req_token_url']").value;
            r.auth_base_url = f.querySelector("input[name='auth_base_url']").value;
            r.access_token_url = f.querySelector("input[name='access_token_url']").value;

            r.profile_url = f.querySelector("input[name='profile_url']").value;
            r.email_key = f.querySelector("input[name='email_key']").value;
            r.identifier_key = f.querySelector("input[name='identifier_key']").value;

            resolve(r);
            return true;
        }
        function populate_form(f, kws) {

            f.querySelector("#provider").innerText = kws.provider || '';
            f.querySelector("input[name='provider']").value = kws.provider || '';
            f.querySelector("input[name='version']").value = kws.version || '';
            f.querySelector("input[name='mode']").value = kws.mode || '';

            f.querySelector("input[name='client_key']").value = kws.client_key || '';
            f.querySelector("input[name='client_secret']").value = kws.client_secret || '';

            f.querySelector("input[name='redirect']").value = kws.redirect || '';
            f.querySelector("input[name='req_token_url']").value = kws.req_token_url || '';
            f.querySelector("input[name='auth_base_url']").value = kws.auth_base_url || '';
            f.querySelector("input[name='access_token_url']").value = kws.access_token_url || '';

            f.querySelector("input[name='profile_url']").value = kws.profile_url || '';
            f.querySelector("input[name='email_key']").value = kws.email_key || '';
            f.querySelector("input[name='identifier_key']").value = kws.identifier_key || '';
            return undefined;
        }

        var kw = {provider: provider};
        if (provider === 'Oauthtest') {

            kw.version = '1';
            kw.mode = '';
            kw.redirect = '/auth/oauth1/cb';
            kw.req_token_url = 'http://oauthbin.com/v1/request-token';
            kw.auth_base_url = '';
            kw.access_token_url = 'http://oauthbin.com/v1/access-token';
            kw.profile_url = 'http://oauthbin.com/v1/echo?%7B%22email%22%3A%22testuser%40here.now%22%2C%22id%22%3A%22012345%22%7D';
            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }
        else if (provider === 'Twitter') {

            kw.version = '1';
            kw.mode = 'twitter';
            kw.redirect = '/auth/oauth1/cb';
            kw.req_token_url = 'https://api.twitter.com/oauth/request_token';
            kw.auth_base_url = 'https://api.twitter.com/oauth/authorize';
            kw.access_token_url = 'https://api.twitter.com/oauth/access_token';
            kw.profile_url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }
        else if (provider === 'Facebook') {

            kw.version = '2';
            kw.mode = 'facebook';
            kw.redirect = '/auth/oauth2/cb	';
            kw.req_token_url = '';
            kw.auth_base_url = 'https://www.facebook.com/dialog/oauth';
            kw.access_token_url = 'https://graph.facebook.com/oauth/access_token';
            kw.profile_url = 'https://graph.facebook.com/me?';
            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }
        else if (provider === 'Google') {

            kw.version = '2';
            kw.mode = 'google';
            kw.redirect = '/auth/oauth2/cb';
            kw.req_token_url = '';
            kw.auth_base_url = 'https://accounts.google.com/o/oauth2/auth';
            kw.access_token_url = 'https://accounts.google.com/o/oauth2/token';
            kw.profile_url = 'https://www.googleapis.com/oauth2/v1/userinfo';
            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }
        else if (provider === 'OpenID2') {

            kw.version = '0';
            kw.mode = 'none';
            kw.redirect = 'none';
            kw.req_token_url = '';
            kw.auth_base_url = 'none';
            kw.access_token_url = 'none';
            kw.profile_url = 'none';
            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }
        else {

            kw.identifier_key = 'id';
            kw.email_key = 'email';
        }

        return Rdbhost.show_form('fedauth', on_submit, populate_form, kw);
    }


    function add_fedauth_entry(d) {

        var q = "INSERT INTO auth.fedoauth_providers  " +
                "       (provider, version, client_key, client_secret, redirect, mode, req_token_url, " +
                "        auth_base_url, access_token_url, profile_url, identifier_key, email_key) " +
                "VALUES(%(provider)s, %(version)s, %(client_key)s, %(client_secret)s, %(redirect)s," +
                "        %(mode)s, %(req_token_url)s, %(auth_base_url)s, %(access_token_url)s, %(profile_url)s," +
                "        %(identifier_key)s, %(email_key)s); ";

        return Rdbhost.super().query(q).params(d).get_data();
    }


    /* supervisory functions that handle setup
     *
     */

    var createPasswordTable = '\
    CREATE TABLE auth.account_passwords ( \
      idx INTEGER REFERENCES auth.fedauth_accounts (idx), \
      password VARCHAR(150) \
    );';

    function add_password_table() {

        return Rdbhost.super()
                .query(createPasswordTable)
                .go();
    }


    var addLoginEntry = "\
    INSERT INTO auth.fedauth_accounts ( \
           (idx, issuer, identifier, profile, key) \
           VALUES(DEFAULT, 'LocalPassword', %(login)s, '{}', \
               md5(random()::text) || md5(random()::text) || md5(random()::text) ); \
         \
    INSERT INTO auth.account_passwords (idx, password) \
          VALUES (currval('auth.fedauth_accounts_idx_seq'::regclass), MD5(%(password)s);";

    function insert_localpassword_sql(parms) {

        return Rdbhost.super()
            .query(addLoginEntry)
            .params({'login': parms[1], 'password': parms[2]})
            .go();
    }


    /* extend Rdbhost object to add Authentication specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.Authenticate = window.Rdbhost.Authenticate || {};
    window.Rdbhost.Authenticate.admin = _.extend(window.Rdbhost.admin || {}, {

        add_table: function(tablename) {

            if (tablename === 'account_passwords') {

                return add_password_table();
            }
            else
                throw new Error('tablename {} not recognized'.replaced('{}', tablename))
        },

        fedauth_dialog: fedauth_dialog,

        add_fedauth_entry: add_fedauth_entry
    })

}(window));
