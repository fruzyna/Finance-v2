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
        connection.query(`SELECT DISTINCT location FROM transactions
                      WHERE user_id = ${user_id}`, function (error, locations, fields)
        {
            if (error || locations.length <= 0)
            {
                locations = {}
            }
            connection.query(`SELECT DISTINCT name FROM accounts
                                WHERE user_id = ${user_id}`, function (error, accounts, fields)
            {
                if (error || accounts.length <= 0)
                {
                    accounts = {}
                }
                connection.query(`SELECT DISTINCT category FROM transactions
                                WHERE user_id = ${user_id}`, function (error, categories, fields)
                {
                    if (error || categories.length <= 0)
                    {
                        categories = {}
                    }
                    
                    res.render('bulkEdit', { error_text: req.query.error_text, title: 'Finance | Bulk Edit', query: req.query, accounts: accounts, categories: categories, locations: locations })
                })
            })
        })
    })
})

router.post('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let title     = utils.create_clause(req.body.title, 'AND t.title = "$VALUE"')
    let location  = utils.create_clause(req.body.location, 'AND t.location = "$VALUE"')
    let account   = utils.create_clause(req.body.account, 'AND a.name = "$VALUE"')
    let before    = utils.create_clause(req.body.before, `AND datediff(t.date, ${utils.process_date(req.body.before)}) < 0`)
    let after     = utils.create_clause(req.body.after, `AND datediff(t.date, ${utils.process_date(req.body.after)}) > 0`)
    let category  = utils.create_clause(req.body.category, 'AND t.category = "$VALUE"')
    let note      = utils.create_clause(req.body.note, 'AND t.note = "$VALUE"')
    let new_title     = utils.create_clause(req.body.new_title, 't.title = "$VALUE"')
    let new_location  = utils.create_clause(req.body.new_location, 't.location = "$VALUE"')
    let new_account   = utils.create_clause(req.body.new_account, `t.account_id = (SELECT id FROM accounts WHERE name = "$VALUE" and user_id = ${user_id})`)
    let new_before    = utils.create_clause(req.body.new_before, 't.before = "$VALUE"')
    let new_after     = utils.create_clause(req.body.new_after, 't.after = "$VALUE"')
    let new_category  = utils.create_clause(req.body.new_category, 't.category = "$VALUE"')
    let new_note      = utils.create_clause(req.body.new_note, 't.note = "$VALUE"')
    let set = ''
    let sets = [new_title, new_location, new_account, new_before, new_after, new_category, new_note]
    sets.forEach(function (item, index) {
        if (item != '')
        {
            if (set != '')
            {
                set += ', '
            }
            set += item
        }
    })

    connection.query(`UPDATE transactions as t, accounts as a SET ${set}
                      WHERE t.user_id = ${user_id} AND a.user_id = ${user_id} ${title} ${location} ${account} ${before} ${after} ${category} ${note}`,
                    function (error, results, fields)
    {
        if (error)
        {
            console.log(error)
            res.redirect('/bulkEdit?error_text=Error making search')
        }
        else
        {
            let queryStr = '?'
            let queries = {'title': req.body.title, 'location': req.body.location, 'account': req.body.account, 'before': req.body.before, 'after': req.body.after, 'category': req.body.category, 'note': req.body.note}
            let new_queries = {'title': req.body.new_title, 'location': req.body.new_location, 'account': req.body.new_account, 'before': req.body.new_before, 'after': req.body.new_after, 'category': req.body.new_category, 'note': req.body.new_note}
            Object.keys(queries).forEach(function (key, index) {
                let query = queries[key]
                if (new_queries[key] != '')
                {
                    query = new_queries[key]
                }
                if (query != '')
                {
                    if (queryStr != '?')
                    {
                        queryStr += '&'
                    }
                    queryStr += `${key}=${query}`
                }
            })
            res.redirect(`/history${queryStr}`)
        }
    })
  })
})

module.exports = router