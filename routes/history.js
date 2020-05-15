var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

/**
 * Delete Entry
 */
router.get('/delete', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`DELETE FROM transactions
                      WHERE id = ${utils.sanitize(req.query.id)}`, function (error, results, fields)
    {
      if (error)
      {
        res.send(`Error deleting entry ${req.query.id}`)
      }
      else
      {
        res.redirect('/history')
      }
    })
  })
})

/**
 * Transaction History
 */
router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let limit = 10
    if (req.query.limit !== undefined)
    {
      limit = req.query.limit
    }

    let title     = utils.create_clause(req.query.title, 'AND t.title LIKE "%$VALUE%"')
    let location  = utils.create_clause(req.query.location, 'AND t.location = "$VALUE"')
    let account   = utils.create_clause(req.query.account, 'AND a.name = "$VALUE"')
    let before    = utils.create_clause(req.query.before, `AND datediff(t.date, ${utils.process_date(req.query.before)}) < 0`)
    let after     = utils.create_clause(req.query.after, `AND datediff(t.date, ${utils.process_date(req.query.after)}) > 0`)
    let category  = utils.create_clause(req.query.category, 'AND t.category = "$VALUE"')
    let note      = utils.create_clause(req.query.note, 'AND t.note = "$VALUE"')

    connection.query(`(SELECT t.id, title, location, date_format(date, "%Y-%m-%d") as date, round(amount, 2) as raw, format(amount, 2) as amount, a.name, category, note, "Edit" as edtext, "Delete" as deltext
                        FROM transactions as t
                        INNER JOIN accounts as a ON t.account_id = a.id
                        WHERE t.user_id = ${user_id} ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                        ORDER BY t.date DESC LIMIT ${limit})
                      UNION
                      (SELECT "" as id, "Total" as title, "" as location, "" as date, round(sum(s.amount), 2) as raw, format(sum(s.amount), 2) as amount, "" as name, "" as category, "" as note, "" as edtext, "" as deltext
                        FROM (SELECT title, location, date, amount, a.name, category, note
                        FROM transactions as t
                        INNER JOIN accounts as a ON t.account_id = a.id
                        WHERE t.user_id = ${user_id} ${title} ${location} ${account} ${before} ${after} ${category} ${note}
                        ORDER BY t.date DESC LIMIT ${limit}) as s)`, 
                      function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.render('history', { error_text: 'Error making search', title: 'Finance | History', entries: results, query: req.query })
      }
      else if (results.length > 1)
      {
        res.render('history', { error_text: req.query.error_text, title: 'Finance | History', entries: results, query: req.query })
      }
      else
      {
        res.render('history', { error_text: 'No results found', title: 'Finance | History', entries: results, query: req.query })
      }
    })
  })
})

router.post('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let date        = utils.process_date(req.body.date)
    let account     = utils.sanitize(req.body.account)
    let title       = utils.sanitize(req.body.title)
    let location    = utils.sanitize(req.body.location)
    let amount      = utils.sanitize(req.body.amount)
    let category    = utils.sanitize(req.body.category)
    let note        = utils.sanitize(req.body.note)
    let id          = utils.sanitize(req.body.id)

    connection.query(`UPDATE transactions as t, accounts as a SET account_id = a.id, date = ${date}, title = ${title}, location = ${location},
                        amount = ${amount}, category = ${category}, note = ${note}
                      WHERE t.id = ${id} and a.name = ${account} and t.user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect('/history?error_text=Error editing transaction')
      }
      else
      {
        res.redirect('/history')
      }
    })
  })
})

module.exports = router