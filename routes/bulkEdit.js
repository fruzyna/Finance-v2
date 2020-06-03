var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
    utils.session_exists(connection, req, res, function (user_id)
    {
        res.render('bulkEdit', { error_text: req.query.error_text, title: 'Finance | Bulk Edit', query: req.query })
    })
})

router.post('/', function(req, res, next)
{
    utils.session_exists(connection, req, res, function (user_id)
    {
        let type      = req.body.type
        let oldVal    = utils.sanitize(req.body.old)
        let newVal    = utils.sanitize(req.body.new)

        if (type != 'account')
        {
            connection.query(`UPDATE transactions SET ${type} = ${newVal}
                                WHERE ${type} = ${oldVal} and user_id = ${user_id}`, function (error, results, fields)
            {
                if (error)
                {
                    console.log(error)
                    res.redirect(`/bulkEdit?error_text=Error editing transactions&type=${type}&old=${req.body.old}&new=${req.body.new}`)
                }
                else
                {
                    res.redirect(`/history?${type}=${req.body.new}`)
                }
            })
        }
        else
        {
            connection.query(`SELECT id FROM accounts WHERE name = ${newVal} and user_id = ${user_id}`, function (error, results, fields)
            {
                if (error || results.length < 1)
                {
                    console.log(error)
                    res.redirect(`/bulkEdit?error_text=Could not find account, ${newVal}&type=${type}&old=${req.body.old}`)
                }
                else
                {
                    connection.query(`UPDATE transactions as t, accounts as a SET t.account_id = "${results[0].id}"
                                        WHERE t.account_id = a.id and a.name = ${oldVal} and t.user_id = ${user_id} and a.user_id = ${user_id}`, function (error, results, fields)
                    {
                        if (error)
                        {
                            console.log(error)
                            res.redirect(`/bulkEdit?error_text=Error editing transactions&type=${type}&old=${req.body.old}&new=${req.body.new}`)
                        }
                        else
                        {
                            res.redirect(`/history?${type}=${req.body.new}`)
                        }
                    })
                }
            })
        }
    })
})

module.exports = router