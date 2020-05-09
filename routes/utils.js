module.exports = {
    process_date:
        // convert relative dates
        function process_date(date)
        {
            if (date === undefined)
            {
                date = ''
            }
            date = date.trim().toLowerCase()
            if (date == '' || date == 'today')
            {
                return 'now()'
            }
            else if (date == 'yesterday')
            {
                return 'subdate(now(), 1)'
            }
            else if (date == 'tomorrow')
            {
                return 'adddate(now(), 1)'
            }
            return `"${date}"`
        },
    generate_key:
        // generate a new session key
        function generate_key()
        {
            let str = ''
            while (str.length < 32)
            {
                str += Math.random().toString(36).substr(2)
            }
            return str.substr(0, 32)
        },
    session_exists:
        // redirect to login if a session doesn't already exist
        function session_exists(connection, req, res, response)
        {
            let session = req.cookies.session
            if (session === undefined)
            {
                res.redirect('/login')
            }
            else
            {
                // check if session key is valid
                connection.query(`SELECT user_id FROM sessions
                                WHERE session_key = "${session}"`, function (error, results, fields)
                {
                if (error)
                {
                    res.send(error)
                }
                else if (results.length > 0)
                {
                    // update the last time this key was accessed
                    connection.query(`UPDATE sessions SET last_accessed = now()
                                    WHERE session_key = "${session}"`)

                    // respond to request
                    response(`"${results[0].user_id}"`)
                }
                else
                {
                    res.cookie('session', '', { maxAge: 0})
                    res.redirect('/login')
                }
                })
            }
        },
    create_clause:
        // create a where clause based on a given format
        function create_clause(value, format)
        {
            if (value === undefined || value == '')
            {
                return ''
            }
            else
            {
                return format.replace('$VALUE', value)
            }
        },
        validate_password:
            function validate_password(password, verify)
            {
                if (password != verify)
                {
                    return 'Passwords do not match'
                }
                else if (password.length < 8)
                {
                    return 'Password must be at least 8 characters'
                }
                return 'valid'
            },
        validate_username:
            function validate_username(username)
            {
                if (!username.match(/^[0-9a-z]+$/))
                {
                  return 'Invalid character in username'
                }
                return 'valid'
            }
}